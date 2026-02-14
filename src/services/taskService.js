import prisma from "../config/database.js";
import { createNotification } from "./notificationService.js";
import { createLog, LOG_ACTIONS } from "./systemLogService.js";

const genTaskId = () => {
    return "T_" + Date.now().toString().slice(-3) + Math.floor(Math.random() * 10);
};

const taskServices = {
    // Create Task
    createTask: async (req) => {
        try {
            const actor = req.user;
            console.log("DEBUG CREATE TASK - User:", actor);
            const { title, description, beginDate, dueDate, priority, projectId, assignedTo, memberIds, parentTaskId } = req.body;
            console.log("DEBUG CREATE TASK - Body:", req.body);

            const role = (actor.roleName || '').toLowerCase();
            const roleId = actor.roleId || '';
            console.log("DEBUG CREATE TASK - RoleName:", role, "RoleID:", roleId);

            // ========================================
            // STRICT ROLE-BASED PERMISSION CHECK
            // ========================================
            // PMO: Can create Main Tasks (no parentTaskId)
            // Leader: Can create Subtasks (must have parentTaskId) for their department
            // Director: View-only, CANNOT create tasks
            // Staff: CANNOT create tasks (only receives assigned subtasks)
            // Admin: CANNOT create tasks (system management only)

            const isPMO = role === 'pmo';
            const isLeader = role === 'leader' || role === 'manager' || role === 'tp';
            const isDirector = role === 'director' || role === 'giám đốc';
            const isAdmin = role === 'admin' || role === 'system admin' || role === 'admin hệ thống';
            const isStaff = role === 'staff' || role === 'nhân viên';

            // Director and Admin CANNOT create tasks
            if (isDirector) {
                return { status: 403, message: "Giám đốc không có quyền tạo công việc. Vui lòng yêu cầu PMO thực hiện." };
            }
            if (isAdmin) {
                return { status: 403, message: "Admin hệ thống không tham gia vào workflow công việc." };
            }
            if (isStaff) {
                return { status: 403, message: "Nhân viên chỉ được nhận công việc được giao, không tự tạo." };
            }

            // Leader can ONLY create subtasks (must have parentTaskId)
            if (isLeader && !parentTaskId) {
                return { status: 403, message: "Leader chỉ có thể tạo subtask từ Main Task. Vui lòng chọn task cha." };
            }

            // Only PMO and Leader with parentTaskId can proceed
            if (!isPMO && !isLeader) {
                return { status: 403, message: `Role '${role}' không có quyền tạo công việc.` };
            }

            if (!title || !projectId) {
                return { status: 400, message: "Missing required fields: title, projectId" };
            }

            // Verify Project exists
            const project = await prisma.project.findUnique({ where: { P_ID: projectId } });
            if (!project || project.IsDeleted) return { status: 404, message: `Project not found (ID: ${projectId})` };

            // Prepare memberIds array
            let membersToAssign = [];
            if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
                membersToAssign = memberIds;
            } else if (assignedTo) {
                membersToAssign = [assignedTo];
            }

            // ========================================
            // LEADER RESTRICTION: Only assign Staff of their Department
            // ========================================
            if (isLeader) {
                const leaderDeptId = actor.departmentId;
                if (!leaderDeptId) {
                    return { status: 403, message: "Leader không thuộc phòng ban nào." };
                }

                // Check project belongs to leader's department
                if (project.D_ID !== leaderDeptId) {
                    return { status: 403, message: "Bạn chỉ có thể tạo task cho dự án của phòng ban mình." };
                }

                if (membersToAssign.length > 0) {
                    // Check if all assignees belong to leader's department
                    const invalidMembers = await prisma.member.count({
                        where: {
                            M_ID: { in: membersToAssign },
                            D_ID: { not: leaderDeptId }
                        }
                    });
                    if (invalidMembers > 0) {
                        return { status: 403, message: "Chỉ được giao việc cho nhân viên thuộc phòng ban của mình." };
                    }
                }
            }

            // Verify members exist
            if (membersToAssign.length > 0) {
                const members = await prisma.member.findMany({
                    where: {
                        M_ID: { in: membersToAssign },
                        IsDeleted: false
                    }
                });

                if (members.length !== membersToAssign.length) {
                    return { status: 404, message: "One or more members not found" };
                }
            }

            const taskId = genTaskId();

            // Create task with members in transaction
            const newTask = await prisma.$transaction(async (tx) => {
                // Create the task
                const task = await tx.task.create({
                    data: {
                        T_ID: taskId,
                        Title: title,
                        Description: description,
                        Begin_Date: beginDate ? new Date(beginDate) : null,
                        Due_Date: dueDate ? new Date(dueDate) : null,
                        Priority: priority,
                        P_ID: projectId,
                        Assigned_ID_M_ID: membersToAssign[0] || null, // Primary assignee (backward compat)
                        Parent_T_ID: parentTaskId || null,
                        Created_By_A_ID: actor?.aid,
                        Status: "pending",
                        IsDeleted: false,
                    }
                });

                // Create Task_Member records for all members
                if (membersToAssign.length > 0) {
                    await tx.task_Member.createMany({
                        data: membersToAssign.map((memberId, index) => ({
                            T_ID: taskId,
                            M_ID: memberId,
                            Role: index === 0 ? 'lead' : 'member',
                            Added_By_A_ID: actor?.aid
                        }))
                    });
                }

                // Fetch complete task with all relations
                return await tx.task.findUnique({
                    where: { T_ID: taskId },
                    include: {
                        Member: true,
                        Project: true,
                        Account: true,
                        Task_Member: {
                            include: {
                                Member: { include: { Department: true } }
                            }
                        }
                    }
                });
            });

            // NOTIFICATION: Task Assigned
            membersToAssign.forEach(memberId => {
                // Find account ID for member (Notification needs Account ID)
                // We'll do this async to not block response
                prisma.account.findFirst({ where: { M_ID: memberId } }).then(acc => {
                    if (acc) {
                        createNotification(
                            'task_assigned',
                            acc.A_ID,
                            actor.aid,
                            `Bạn được giao công việc mới: "${title}"`,
                            taskId,
                            projectId
                        );
                    }
                });
            });

            // LOGGING
            await createLog(
                LOG_ACTIONS.TASK_CREATE,
                actor.aid,
                `Đã tạo công việc mới: ${newTask.Title}`,
                'task',
                newTask.T_ID
            );

            return { status: 201, data: newTask };
        } catch (err) {
            console.error("CREATE TASK ERROR:", err);
            return { status: 500, message: `Server error: ${err.message}` };
        }
    },

    // List Tasks
    listTasks: async (req) => {
        try {
            const actor = req.user;
            const role = (actor.roleName || '').toLowerCase();
            const { projectId, assignedTo, status } = req.query;
            const where = {
                IsDeleted: false,
                Parent_T_ID: null  // Only get main tasks, exclude subtasks
            };

            if (projectId) where.P_ID = projectId;

            // Fix: assignedTo filter should check Task_Member relation to support multi-assignee
            if (assignedTo) {
                where.Task_Member = {
                    some: { M_ID: assignedTo }
                };
            }

            if (status) where.Status = status;

            // SECURITY SCOPING RESTORED (Smart Scoping)
            // Ensure Staff only sees relevant tasks.
            const isStaff = role === 'staff' || role === 'user';

            if (isStaff) {
                if (!actor.mid) {
                    return { status: 200, data: [] };
                }
                // If checking assignedTo, we already filtered deeply. 
                // If NOT checking assignedTo, we must Enforce "My Tasks" or "Project Tasks I'm in".
                // Let's enforce: Staff sees tasks where they are a member.
                // Merge into existing Task_Member filter if exists.
                if (where.Task_Member) {
                    // Already have a filter (assignedTo), ensure it matches current user? 
                    // No, if I filter assignedTo=AnotherUser, Staff shouldn't see it?
                    // Yes, Staff should only see THEIR tasks. 
                    where.Task_Member = {
                        some: { M_ID: actor.mid }
                    };
                } else {
                    where.Task_Member = {
                        some: { M_ID: actor.mid }
                    };
                }
            } else if (role === 'leader' || role === 'manager') {
                // Leader sees all in Dept
                if (actor.departmentId) {
                    // OR logic is tricky with AND filters.
                    // But generally Leader should see Dept tasks.
                    // Let's rely on Project scoping if projectId is passed.
                    // Or just generic "Dept" filter if no filters.
                }
            }

            // Admin/PMO see all.

            const tasks = await prisma.task.findMany({
                where,
                include: {
                    Member: { include: { Department: true } },
                    Project: { include: { Department: true } },
                    Account: { select: { UserName: true } },
                    Task_Member: {
                        include: {
                            Member: { include: { Department: true } }
                        }
                    },
                    ChecklistItems: true,
                    Task_Labels: { include: { Label: true } },
                    Attachments: true
                },
                orderBy: { Created_By_A_ID: 'desc' }
            });

            return { status: 200, data: tasks };
        } catch (err) {
            console.error("LIST TASKS ERROR:", err);
            return { status: 500, message: "Server error listing tasks" };
        }
    },

    // Get Task
    getTask: async (req) => {
        try {
            const { id } = req.params;
            const task = await prisma.task.findUnique({
                where: { T_ID: id },
                include: {
                    Member: { include: { Department: true } },
                    Project: { include: { Department: true } },
                    Subtasks: {
                        where: { IsDeleted: false },
                        include: {
                            Member: true,
                            Task_Member: {
                                include: {
                                    Member: { include: { Department: true } }
                                }
                            }
                        }
                    },
                    Task_Report: { where: { IsDeleted: false } },
                    Task_Member: {
                        include: {
                            Member: { include: { Department: true } }
                        }
                    },
                    ChecklistItems: true,
                    Task_Labels: { include: { Label: true } },
                    Attachments: true,
                    TaskComments: {
                        include: { Account: { select: { UserName: true, Avatar: true, M_ID: true } } },
                        orderBy: { Created_At: 'desc' }
                    }
                }
            });

            if (!task || task.IsDeleted) {
                return { status: 404, message: "Task not found" };
            }

            return { status: 200, data: task };
        } catch (err) {
            console.error("GET TASK ERROR:", err);
            return { status: 500, message: "Server error getting task" };
        }
    },

    // Update Task
    updateTask: async (req) => {
        try {
            const { id } = req.params;
            const actor = req.user;
            const role = (actor.roleName || '').toLowerCase();
            const { title, description, beginDate, dueDate, priority, assignedTo, memberIds, status, progress } = req.body;

            const task = await prisma.task.findUnique({ where: { T_ID: id } });
            if (!task || task.IsDeleted) {
                return { status: 404, message: "Task not found" };
            }

            // ========================================
            // STRICT ROLE-BASED PERMISSION CHECK FOR UPDATE
            // ========================================
            const isPMO = role === 'pmo';
            const isLeader = role === 'leader' || role === 'manager' || role === 'tp';
            const isDirector = role === 'director' || role === 'giám đốc';
            const isAdmin = role === 'admin' || role === 'system admin' || role === 'admin hệ thống';
            const isStaff = role === 'staff' || role === 'nhân viên';

            // Director: VIEW ONLY - Cannot update anything
            if (isDirector) {
                return { status: 403, message: "Giám đốc chỉ có quyền xem, không thể chỉnh sửa công việc." };
            }

            // Admin: Cannot update tasks (system management only)
            if (isAdmin) {
                return { status: 403, message: "Admin hệ thống không tham gia vào workflow công việc." };
            }

            // Staff restrictions: Only update their OWN task status
            if (isStaff) {
                // Check if staff is assigned to this task
                const isAssigned = await prisma.task_Member.findFirst({
                    where: {
                        T_ID: id,
                        Member: { Account: { some: { A_ID: actor.aid } } }
                    }
                });

                if (!isAssigned) {
                    return { status: 403, message: "Bạn chỉ có thể cập nhật công việc được giao cho mình." };
                }

                // Staff can ONLY update progress status (in_progress, review_request, done) AND progress %
                // RELAXED: Allow Staff to update Description and Dates (Self-management)
                const allowedStaffFields = ['status', 'progress', 'description', 'beginDate', 'dueDate'];
                const restrictedFields = Object.keys(req.body).filter(f => !allowedStaffFields.includes(f));

                if (restrictedFields.length > 0) {
                    return { status: 403, message: "Nhân viên không được quyền sửa tiêu đề hoặc người thực hiện." };
                }

                // Staff can only set certain statuses
                const allowedStaffStatuses = ['in_progress', 'in-progress', 'running', 'review_request', 'waiting-approval', 'done', 'completed'];
                if (status && !allowedStaffStatuses.includes(status)) {
                    return { status: 403, message: `Nhân viên không thể đặt trạng thái '${status}'. Chỉ được: in_progress/running, review_request/waiting-approval, done/completed.` };
                }
            }

            // Leader restrictions: Only tasks of their department
            if (isLeader) {
                const project = await prisma.project.findUnique({ where: { P_ID: task.P_ID } });
                if (project && actor.departmentId && project.D_ID !== actor.departmentId) {
                    return { status: 403, message: "Bạn chỉ có thể chỉnh sửa công việc của phòng ban mình." };
                }
            }

            const data = {};

            // Normalize status for logic (always use underscore internal, or respect DB)
            // If DB uses underscore, we map hyphen to underscore.
            let normalizedStatus = status;
            if (status === 'in-progress') normalizedStatus = 'in_progress';
            if (status === 'waiting-approval') normalizedStatus = 'waiting_approval'; // If needed

            // NOTE: Check if DB prefers 'in-progress' or 'in_progress'. 
            // Based on previous files, 'in_progress' is standard for DB enum if used, or string.
            // Let's stick to what was allowedStaffStatuses keys: 'in_progress'.

            // Only populate data if not staff (or logic allows) - Blocked above
            if (title) data.Title = title;
            if (description) data.Description = description;
            if (beginDate) data.Begin_Date = new Date(beginDate);
            if (dueDate) data.Due_Date = new Date(dueDate);
            if (priority) data.Priority = priority;
            if (assignedTo) data.Assigned_ID_M_ID = assignedTo;
            if (progress !== undefined && progress !== null) data.Progress = parseInt(progress); // Add Progress Mapping

            if (status) {
                data.Status = normalizedStatus; // Use normalized
                if (normalizedStatus === 'done' || normalizedStatus === 'completed') {
                    data.Complete_At = new Date();
                }
            }

            // Handle multi-member assignment
            if (memberIds && Array.isArray(memberIds)) {
                // Use transaction to update task and members
                const updated = await prisma.$transaction(async (tx) => {
                    // Update task
                    const updatedTask = await tx.task.update({
                        where: { T_ID: id },
                        data,
                    });

                    // Delete existing Task_Member records
                    await tx.task_Member.deleteMany({
                        where: { T_ID: id }
                    });

                    // Create new Task_Member records
                    if (memberIds.length > 0) {
                        await tx.task_Member.createMany({
                            data: memberIds.map((memberId, index) => ({
                                T_ID: id,
                                M_ID: memberId,
                                Role: index === 0 ? 'lead' : 'member',
                                Added_By_A_ID: actor?.aid
                            }))
                        });
                    }

                    // Fetch updated task with members
                    return await tx.task.findUnique({
                        where: { T_ID: id },
                        include: {
                            Member: true,
                            Project: { include: { Department: true } },
                            Task_Member: {
                                include: {
                                    Member: { include: { Department: true } }
                                }
                            }
                        }
                    });
                });

                // LOGGING STATUS CHANGE
                if (normalizedStatus && normalizedStatus !== task.Status) {
                    await createLog(
                        LOG_ACTIONS.TASK_STATUS_CHANGE,
                        actor.aid,
                        `Đã thay đổi trạng thái sang "${normalizedStatus}"`,
                        'task',
                        id
                    );
                } else {
                    // Generic Update Log
                    await createLog(
                        LOG_ACTIONS.TASK_UPDATE,
                        actor.aid,
                        `Đã cập nhật thông tin công việc`,
                        'task',
                        id
                    );
                }

                return { status: 200, data: updated };
            } else {
                // Simple update without members
                const updated = await prisma.task.update({
                    where: { T_ID: id },
                    data,
                });

                // NOTIFICATIONS for simple update
                // 1. Check Deadline Change
                if (dueDate && task.Due_Date && new Date(dueDate).getTime() !== task.Due_Date.getTime()) {
                    // Find task members to notify
                    const members = await prisma.task_Member.findMany({ where: { T_ID: id }, include: { Member: { include: { Account: true } } } });
                    members.forEach(tm => {
                        if (tm.Member?.Account?.[0]?.A_ID) {
                            createNotification(
                                'deadline_changed',
                                tm.Member.Account[0].A_ID,
                                actor.aid,
                                `Thời hạn công việc "${task.Title}" đã thay đổi.`,
                                id,
                                task.P_ID
                            );
                        }
                    });
                }

                // 2. Check Status Change with Role-based Routing
                if (normalizedStatus && normalizedStatus !== task.Status) { // Use normalizedStatus
                    const { NOTIFICATION_TYPES, getAccountsByRole, notifyLeaderReviewRequest, notifyStaffReviewCompleted } = await import("./notificationService.js");

                    // Get actor name for messages
                    const actorName = actor.username || actor.name || 'Người dùng';

                    switch (normalizedStatus) { // Use normalizedStatus
                        case 'review_request':
                        case 'waiting-approval':
                            // Staff sends to Leader for review
                            // Find Leader of the task's project department
                            const project = await prisma.project.findUnique({
                                where: { P_ID: task.P_ID },
                                include: { Department: true }
                            });
                            if (project?.D_ID) {
                                const leaderIds = await getAccountsByRole('leader', project.D_ID);
                                for (const leaderId of leaderIds) {
                                    await createNotification(
                                        NOTIFICATION_TYPES.REVIEW_REQUESTED,
                                        leaderId,
                                        actor.aid,
                                        `${actorName} yêu cầu duyệt task "${task.Title}"`,
                                        id,
                                        task.P_ID
                                    );
                                }
                                console.log(`[NOTIFICATION] Review requested for task "${task.Title}" - notified ${leaderIds.length} leaders`);
                            }
                            break;

                        case 'approved':
                            // Leader approves → notify Staff
                            const membersApproved = await prisma.task_Member.findMany({
                                where: { T_ID: id },
                                include: { Member: { include: { Account: true } } }
                            });
                            membersApproved.forEach(tm => {
                                if (tm.Member?.Account?.[0]?.A_ID && tm.Member.Account[0].A_ID !== actor.aid) {
                                    createNotification(
                                        NOTIFICATION_TYPES.REVIEW_COMPLETED,
                                        tm.Member.Account[0].A_ID,
                                        actor.aid,
                                        `Task "${task.Title}" đã được duyệt`,
                                        id,
                                        task.P_ID
                                    );
                                }
                            });
                            break;

                        case 'rejected':
                            // Leader rejects → notify Staff with feedback
                            const membersRejected = await prisma.task_Member.findMany({
                                where: { T_ID: id },
                                include: { Member: { include: { Account: true } } }
                            });
                            membersRejected.forEach(tm => {
                                if (tm.Member?.Account?.[0]?.A_ID && tm.Member.Account[0].A_ID !== actor.aid) {
                                    createNotification(
                                        NOTIFICATION_TYPES.TASK_REJECTED,
                                        tm.Member.Account[0].A_ID,
                                        actor.aid,
                                        `Task "${task.Title}" bị từ chối. Vui lòng kiểm tra feedback.`,
                                        id,
                                        task.P_ID
                                    );
                                }
                            });
                            break;

                        case 'returned':
                            // Similar to rejected, notify Staff
                            const membersReturned = await prisma.task_Member.findMany({
                                where: { T_ID: id },
                                include: { Member: { include: { Account: true } } }
                            });
                            membersReturned.forEach(tm => {
                                if (tm.Member?.Account?.[0]?.A_ID && tm.Member.Account[0].A_ID !== actor.aid) {
                                    createNotification(
                                        NOTIFICATION_TYPES.TASK_RETURNED,
                                        tm.Member.Account[0].A_ID,
                                        actor.aid,
                                        `Task "${task.Title}" được trả lại để sửa.`,
                                        id,
                                        task.P_ID
                                    );
                                }
                            });
                            break;

                        case 'completed':
                        case 'done':
                            // Staff completes → notify Leader
                            const projDone = await prisma.project.findUnique({
                                where: { P_ID: task.P_ID },
                                include: { Department: true }
                            });
                            if (projDone?.D_ID) {
                                const leaderIdsDone = await getAccountsByRole('leader', projDone.D_ID);
                                for (const leaderId of leaderIdsDone) {
                                    await createNotification(
                                        NOTIFICATION_TYPES.TASK_COMPLETED,
                                        leaderId,
                                        actor.aid,
                                        `${actorName} đã hoàn thành task "${task.Title}"`,
                                        id,
                                        task.P_ID
                                    );
                                }
                            }
                            break;

                        default:
                            // Other status changes - notify members
                            if (status !== task.Status) {
                                const membersOther = await prisma.task_Member.findMany({
                                    where: { T_ID: id },
                                    include: { Member: { include: { Account: true } } }
                                });
                                membersOther.forEach(tm => {
                                    if (tm.Member?.Account?.[0]?.A_ID && tm.Member.Account[0].A_ID !== actor.aid) {
                                        createNotification(
                                            NOTIFICATION_TYPES.STATUS_CHANGED,
                                            tm.Member.Account[0].A_ID,
                                            actor.aid,
                                            `Trạng thái task "${task.Title}" đổi thành: ${status}`,
                                            id,
                                            task.P_ID
                                        );
                                    }
                                });
                            }
                    }
                }

                // LOGGING - Enhanced for status change tracking
                const logService = (await import("./systemLogService.js")).default;

                // Log status change separately if status was updated
                if (normalizedStatus && normalizedStatus !== task.Status) {
                    const statusLabels = {
                        'not_assigned': 'Chưa nhận',
                        'in_progress': 'Đang làm',
                        'waiting_approval': 'Chờ duyệt',
                        'review_request': 'Chờ duyệt',
                        'returned': 'Trả lại',
                        'rejected': 'Từ chối',
                        'approved': 'Đã duyệt',
                        'completed': 'Hoàn thành',
                        'done': 'Hoàn thành',
                    };
                    const oldLabel = statusLabels[task.Status] || task.Status;
                    const newLabel = statusLabels[normalizedStatus] || normalizedStatus;
                    logService.createLog(
                        'task_status_change',
                        actor.aid,
                        `Task "${task.Title}": ${oldLabel} → ${newLabel}`,
                        'Task',
                        id
                    );
                } else {
                    logService.createLog('task_update', actor.aid, `Updated task "${task.Title}"`, 'Task', id);
                }

                return { status: 200, data: updated };
            }
        } catch (err) {
            console.error("UPDATE TASK ERROR:", err);
            return { status: 500, message: "Server error updating task" };
        }
    },

    // Delete Task
    deleteTask: async (req) => {
        try {
            const actor = req.user;
            const role = (actor.roleName || '').toLowerCase();
            const { id } = req.params;

            // PERMISSION CHECK
            // Block Staff from deleting tasks
            if (role === 'staff' || role === 'user') {
                return { status: 403, message: "Access Denied: Staff cannot delete tasks." };
            }

            const task = await prisma.task.findUnique({ where: { T_ID: id } });
            if (!task || task.IsDeleted) {
                return { status: 404, message: "Task not found" };
            }

            const deleted = await prisma.task.update({
                where: { T_ID: id },
                data: {
                    IsDeleted: true,
                    Deleted_At: new Date(),
                    Deleted_By: actor?.aid,
                    Status: "deleted"
                }
            });

            // LOGGING
            await createLog(
                LOG_ACTIONS.TASK_DELETE,
                actor.aid,
                `Đã xóa công việc: ${task.Title}`,
                'task',
                id
            );

            return { status: 200, data: deleted };
        } catch (err) {
            console.error("DELETE TASK ERROR:", err);
            return { status: 500, message: "Server error deleting task" };
        }
    },

    // --- Checklist ---
    addChecklistItem: async (req) => {
        try {
            const { id } = req.params;
            const { content } = req.body;
            const actor = req.user; // Assuming actor is available from req.user
            const item = await prisma.checklistItem.create({
                data: { Content: content, T_ID: id }
            });

            await createLog(
                LOG_ACTIONS.TASK_UPDATE,
                actor.aid,
                `Đã thêm việc cần làm: ${content}`,
                'task',
                id
            );

            return { status: 200, data: item };
        } catch (err) { return { status: 500, message: err.message }; }
    },
    updateChecklistItem: async (req) => {
        try {
            const { itemId } = req.params; // Expect itemId in route like /checklist/:itemId
            const { isCompleted, content } = req.body;
            const actor = req.user; // Assuming actor is available from req.user
            const data = {};
            if (isCompleted !== undefined) data.IsCompleted = isCompleted;
            if (content !== undefined) data.Content = content;

            const item = await prisma.checklistItem.update({
                where: { CL_ID: itemId },
                data
            });

            let logMessage = `Đã cập nhật việc cần làm: ${item.Content}`;
            if (isCompleted !== undefined) {
                logMessage = `Đã đánh dấu việc cần làm "${item.Content}" là ${isCompleted ? 'hoàn thành' : 'chưa hoàn thành'}`;
            }

            await createLog(
                LOG_ACTIONS.TASK_UPDATE,
                actor.aid,
                logMessage,
                'task',
                item.T_ID // Use T_ID from the item
            );

            return { status: 200, data: item };
        } catch (err) { return { status: 500, message: err.message }; }
    },
    deleteChecklistItem: async (req) => {
        try {
            const { itemId } = req.params;
            const actor = req.user; // Assuming actor is available from req.user

            const item = await prisma.checklistItem.findUnique({ where: { CL_ID: itemId } });
            if (!item) return { status: 404, message: "Checklist item not found" };

            await prisma.checklistItem.delete({ where: { CL_ID: itemId } });

            await createLog(
                LOG_ACTIONS.TASK_UPDATE,
                actor.aid,
                `Đã xóa việc cần làm: ${item.Content}`,
                'task',
                item.T_ID
            );

            return { status: 200, message: "Deleted" };
        } catch (err) { return { status: 500, message: err.message }; }
    },

    // --- Labels ---
    addLabel: async (req) => {
        try {
            const actor = req.user;
            const { id } = req.params;
            const { name, color } = req.body;

            const label = await prisma.label.create({
                data: { Name: name, Color: color }
            });
            const taskLabel = await prisma.task_Label.create({
                data: { T_ID: id, L_ID: label.L_ID },
                include: { Label: true }
            });

            await createLog(
                LOG_ACTIONS.TASK_UPDATE,
                actor.aid,
                `Đã gắn nhãn: ${name}`,
                'task',
                id
            );

            // NOTIFICATION: Tag Added
            // Fetch task to get project ID and members
            const task = await prisma.task.findUnique({
                where: { T_ID: id },
                include: { Task_Member: { include: { Member: { include: { Account: true } } } } }
            });
            if (task) {
                task.Task_Member.forEach(tm => {
                    if (tm.Member?.Account?.[0]?.A_ID && tm.Member.Account[0].A_ID !== actor.aid) {
                        createNotification(
                            'label_added',
                            tm.Member.Account[0].A_ID,
                            actor.aid,
                            `Công việc "${task.Title}" đã được gắn thẻ "${name}"`,
                            id,
                            task.P_ID
                        );
                    }
                });
            }

            return { status: 200, data: taskLabel.Label };
        } catch (err) { return { status: 500, message: err.message }; }
    },
    removeLabel: async (req) => {
        try {
            const { id, labelId } = req.params; // taskId, labelId
            const actor = req.user; // Assuming actor is available from req.user

            const label = await prisma.label.findUnique({ where: { L_ID: labelId } });
            if (!label) return { status: 404, message: "Label not found" };

            await prisma.task_Label.deleteMany({
                where: { T_ID: id, L_ID: labelId }
            });

            await createLog(
                LOG_ACTIONS.TASK_UPDATE,
                actor.aid,
                `Đã gỡ nhãn: ${label.Name}`,
                'task',
                id
            );

            return { status: 200, message: "Removed" };
        } catch (err) { return { status: 500, message: err.message }; }
    },

    // --- Attachments ---
    addAttachment: async (req) => {
        try {
            const { id } = req.params;
            const { fileName, fileUrl } = req.body;
            const actor = req.user; // Need user info for sender
            const att = await prisma.attachment.create({
                data: { FileName: fileName, FileUrl: fileUrl, T_ID: id }
            });

            const isLink = fileName === 'liên kết' || fileName === fileUrl;
            const logMessage = isLink ? `Đã đính kèm liên kết: ${fileUrl}` : `Đã đính kèm tệp: ${fileName}`;

            await createLog(
                LOG_ACTIONS.TASK_UPDATE,
                actor.aid,
                logMessage,
                'task',
                id
            );

            // NOTIFICATION: File Attached
            const task = await prisma.task.findUnique({
                where: { T_ID: id },
                include: { Task_Member: { include: { Member: { include: { Account: true } } } } }
            });

            if (task) {
                task.Task_Member.forEach(tm => {
                    const recipientId = tm.Member?.Account?.[0]?.A_ID;
                    // Check if sender is defined (might not be if req.user not passed to addAttachment - need to check Controller)
                    // Assuming controller passes user in req
                    if (recipientId && (!actor || recipientId !== actor.aid)) {
                        createNotification(
                            'file_attached',
                            recipientId,
                            actor?.aid || null,
                            `Tệp mới được đính kèm vào "${task.Title}"`,
                            id,
                            task.P_ID
                        );
                    }
                });
            }
            return { status: 200, data: att };
        } catch (err) { return { status: 500, message: err.message }; }
    },
    deleteAttachment: async (req) => {
        try {
            const { attachmentId } = req.params;
            const actor = req.user; // Assuming actor is available from req.user

            const attachment = await prisma.attachment.findUnique({ where: { AT_ID: attachmentId } });
            if (!attachment) return { status: 404, message: "Attachment not found" };

            await prisma.attachment.delete({ where: { AT_ID: attachmentId } });

            await createLog(
                LOG_ACTIONS.TASK_UPDATE,
                actor.aid,
                `Đã xóa tệp đính kèm: ${attachment.FileName}`,
                'task',
                attachment.T_ID
            );

            return { status: 200, message: 'Đã xóa đính kèm' };
        } catch (err) { return { status: 500, message: err.message }; }
    },

    // --- Comments ---
    addComment: async (req) => {
        try {
            const { id } = req.params;
            const { content } = req.body;
            const actor = req.user;

            const comment = await prisma.taskComment.create({
                data: {
                    Content: content,
                    T_ID: id,
                    A_ID: actor.aid
                },
                include: {
                    Account: { select: { UserName: true, Avatar: true, M_ID: true } }
                }
            });
            // NOTIFICATION: New Comment
            const task = await prisma.task.findUnique({
                where: { T_ID: id },
                include: { Task_Member: { include: { Member: { include: { Account: true } } } } }
            });

            if (task) {
                task.Task_Member.forEach(tm => {
                    const recipientId = tm.Member?.Account?.[0]?.A_ID;
                    if (recipientId && recipientId !== actor.aid) { // Don't notify self
                        createNotification(
                            'comment',
                            recipientId,
                            actor.aid,
                            `${actor.username || 'Ai đó'} đã bình luận trong "${task.Title}"`,
                            id,
                            task.P_ID
                        );
                    }
                });
            }

            return { status: 200, data: comment };
        } catch (err) { return { status: 500, message: err.message }; }
    },
    deleteComment: async (req) => {
        try {
            const { commentId } = req.params;
            const userId = req.user.aid; // Note: user.aid from verifying logic

            // Check ownership
            const comment = await prisma.taskComment.findUnique({ where: { TC_ID: commentId } });
            if (!comment) return { status: 404, message: 'Không tìm thấy bình luận' };
            if (comment.A_ID !== userId) return { status: 403, message: 'Không có quyền xóa bình luận này' };

            await prisma.taskComment.delete({ where: { TC_ID: commentId } });
            return { status: 200, message: 'Đã xóa bình luận' };
        } catch (err) { return { status: 500, message: err.message }; }
    },
    updateComment: async (req) => {
        try {
            const { commentId } = req.params;
            const { content } = req.body;
            const userId = req.user.aid;

            if (!content || !content.trim()) return { status: 400, message: 'Nội dung không được để trống' };

            // Check ownership
            const comment = await prisma.taskComment.findUnique({ where: { TC_ID: commentId } });
            if (!comment) return { status: 404, message: 'Không tìm thấy bình luận' };
            if (comment.A_ID !== userId) return { status: 403, message: 'Không có quyền sửa bình luận này' };

            const updated = await prisma.taskComment.update({
                where: { TC_ID: commentId },
                data: { Content: content },
                include: {
                    Account: { select: { UserName: true, Avatar: true, M_ID: true } }
                }
            });
            return { status: 200, data: updated };
        } catch (err) { return { status: 500, message: err.message }; }
    }
};

export default taskServices;
