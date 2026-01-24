import prisma from "../config/database.js";
import { createNotification } from "./notificationService.js";

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

            // PERMISSION CHECK
            const allowedRoles = ['leader', 'manager', 'admin', 'system admin', 'director', 'tp', 'qa'];
            const allowedRoleIds = ['R_001', 'R_002', 'R_003', 'R_004', 'R_005'];

            const isAllowed = allowedRoles.some(r => role.includes(r)) || allowedRoleIds.includes(roleId);

            if (!isAllowed) {
                console.warn(`Access Denied for Role: ${role} (${roleId})`);
                return { status: 403, message: `Access Denied: Role '${role}' cannot create tasks.` };
            }

            if (!title || !projectId) {
                return { status: 400, message: "Missing required fields: title, projectId" };
            }

            // Verify Project
            const project = await prisma.project.findUnique({ where: { P_ID: projectId } });
            if (!project || project.IsDeleted) return { status: 404, message: `Project not found (ID: ${projectId})` };

            // Prepare memberIds array (support both old and new format)
            let membersToAssign = [];
            if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
                membersToAssign = memberIds;
            } else if (assignedTo) {
                membersToAssign = [assignedTo];
            }

            // Verify all members
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
            const logService = (await import("./systemLogService.js")).default;
            logService.createLog('create_task', actor.aid, `Created task "${title}"`, 'Task', taskId);

            return { status: 201, data: newTask };
        } catch (err) {
            console.error("CREATE TASK ERROR:", err);
            return { status: 500, message: `Server error: ${err.message}` };
        }
    },

    // List Tasks
    listTasks: async (req) => {
        try {
            const { projectId, assignedTo, status } = req.query;
            const where = {
                IsDeleted: false,
                Parent_T_ID: null  // Only get main tasks, exclude subtasks
            };

            if (projectId) where.P_ID = projectId;
            if (assignedTo) where.Assigned_ID_M_ID = assignedTo;
            if (status) where.Status = status;

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
            const { title, description, beginDate, dueDate, priority, assignedTo, memberIds, status } = req.body;

            const task = await prisma.task.findUnique({ where: { T_ID: id } });
            if (!task || task.IsDeleted) {
                return { status: 404, message: "Task not found" };
            }

            const data = {};
            if (title) data.Title = title;
            if (description) data.Description = description;
            if (beginDate) data.Begin_Date = new Date(beginDate);
            if (dueDate) data.Due_Date = new Date(dueDate);
            if (priority) data.Priority = priority;
            if (assignedTo) data.Assigned_ID_M_ID = assignedTo;

            if (status) {
                data.Status = status;
                if (status === 'done' || status === 'completed') {
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

                // 2. Check Status Change (Approval/Done/Return/Submit)
                if (status && status !== task.Status) {
                    let notifType = null;
                    let msg = '';

                    switch (status) {
                        case 'approved':
                            notifType = 'task_approved';
                            msg = `Công việc "${task.Title}" đã được duyệt`;
                            break;
                        case 'returned':
                            notifType = 'task_returned';
                            msg = `Công việc "${task.Title}" đã bị trả lại. Vui lòng kiểm tra.`;
                            break;
                        case 'rejected':
                            notifType = 'task_rejected';
                            msg = `Công việc "${task.Title}" đã bị từ chối.`;
                            break;
                        case 'waiting-approval':
                            notifType = 'task_submitted';
                            msg = `Công việc "${task.Title}" đang chờ duyệt.`;
                            break;
                        case 'completed':
                        case 'done':
                            notifType = 'task_completed';
                            msg = `Công việc "${task.Title}" đã hoàn thành.`;
                            break;
                        default:
                            if (status !== task.Status) {
                                notifType = 'status_changed';
                                msg = `Trạng thái công việc "${task.Title}" đã đổi thành ${status}`;
                            }
                    }

                    if (notifType) {
                        const members = await prisma.task_Member.findMany({ where: { T_ID: id }, include: { Member: { include: { Account: true } } } });
                        members.forEach(tm => {
                            // Don't notify the actor themselves
                            if (tm.Member?.Account?.[0]?.A_ID && tm.Member.Account[0].A_ID !== actor.aid) {
                                createNotification(notifType, tm.Member.Account[0].A_ID, actor.aid, msg, id, task.P_ID);
                            }
                        });

                        // If Submitted, notify Leader specifically if logic requires finding Project Leader (omitted for simplicity, notifying all task members including leader is okay for now)
                    }
                }

                // LOGGING
                const logService = (await import("./systemLogService.js")).default;
                logService.createLog('update_task', actor.aid, `Updated task "${task.Title}"`, 'Task', id);

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
            const { id } = req.params;

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
            const logService = (await import("./systemLogService.js")).default;
            logService.createLog('delete_task', actor.aid, `Deleted task "${task.Title}"`, 'Task', id);

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
            const item = await prisma.checklistItem.create({
                data: { Content: content, T_ID: id }
            });
            return { status: 200, data: item };
        } catch (err) { return { status: 500, message: err.message }; }
    },
    updateChecklistItem: async (req) => {
        try {
            const { itemId } = req.params; // Expect itemId in route like /checklist/:itemId
            const { isCompleted, content } = req.body;
            const data = {};
            if (isCompleted !== undefined) data.IsCompleted = isCompleted;
            if (content !== undefined) data.Content = content;

            const item = await prisma.checklistItem.update({
                where: { CL_ID: itemId },
                data
            });
            return { status: 200, data: item };
        } catch (err) { return { status: 500, message: err.message }; }
    },
    deleteChecklistItem: async (req) => {
        try {
            const { itemId } = req.params;
            await prisma.checklistItem.delete({ where: { CL_ID: itemId } });
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
            await prisma.task_Label.create({
                data: { T_ID: id, L_ID: label.L_ID }
            });

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

            return { status: 200, data: label };
        } catch (err) { return { status: 500, message: err.message }; }
    },
    removeLabel: async (req) => {
        try {
            const { id, labelId } = req.params; // taskId, labelId
            await prisma.task_Label.deleteMany({
                where: { T_ID: id, L_ID: labelId }
            });
            return { status: 200, message: "Removed" };
        } catch (err) { return { status: 500, message: err.message }; }
    },

    // --- Attachments ---
    addAttachment: async (req) => {
        try {
            const { id } = req.params;
            const { fileName, fileUrl } = req.body;
            const att = await prisma.attachment.create({
                data: { FileName: fileName, FileUrl: fileUrl, T_ID: id }
            });
            // NOTIFICATION: File Attached
            const task = await prisma.task.findUnique({
                where: { T_ID: id },
                include: { Task_Member: { include: { Member: { include: { Account: true } } } } }
            });
            const actor = req.user; // Need user info for sender

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
            await prisma.attachment.delete({ where: { AT_ID: attachmentId } });
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
