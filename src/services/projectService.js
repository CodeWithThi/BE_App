import prisma from "../config/database.js";

const genProjectId = () => {
    return "P_" + Date.now().toString().slice(-3) + Math.floor(Math.random() * 10);
};

const projectServices = {
    // Create Project
    createProject: async (req) => {
        try {
            const actor = req.user; // from auth middleware
            const { name, departmentId, beginDate, endDate } = req.body;
            const role = (actor.roleName || '').toLowerCase();

            console.log("DEBUG CREATE PROJECT:", {
                actorName: actor.username,
                roleName: actor.roleName,
                normalizedRole: role,
                body: req.body
            });

            // PERMISSION CHECK
            // Only PMO can create projects. 
            // Admin: NO ("ADMIN KHÔNG tạo dự án")
            // Leader: NO ("Leader KHÔNG tạo project")
            // Staff: NO ("Staff KHÔNG tạo project")
            if (role !== 'pmo') {
                console.log("DEBUG: Access Denied. Role is", role);
                return { status: 403, message: `Access Denied: Role '${role}' cannot create projects. Only PMO allowed.` };
            }

            if (!name || !departmentId) {
                return { status: 400, message: "Missing required fields: name, departmentId" };
            }

            // Check department existence
            const dept = await prisma.department.findUnique({ where: { D_ID: departmentId } });
            if (!dept) return { status: 404, message: "Department not found" };

            // STRICT UNIQUE NAME CHECK
            const existingProject = await prisma.project.findFirst({
                where: {
                    P_Name: name,
                    IsDeleted: false
                }
            });
            if (existingProject) {
                return { status: 400, message: `Tên dự án '${name}' đã tồn tại. Vui lòng chọn tên khác.` };
            }

            const projectId = genProjectId();
            const newProject = await prisma.project.create({
                data: {
                    P_ID: projectId,
                    P_Name: name,
                    P_Description: req.body.description || null,
                    D_ID: departmentId,
                    Begin_Date: beginDate ? new Date(beginDate) : null,
                    End_Date: endDate ? new Date(endDate) : null,
                    Created_By_A_ID: actor?.aid,
                    Status: "active",
                    IsDeleted: false,
                },
            });

            // Send notifications to Director and Admin about new project
            try {
                const { createNotification, getAccountsByRole, NOTIFICATION_TYPES } = await import("./notificationService.js");

                // Notify Directors
                const directorIds = await getAccountsByRole('director');
                for (const dirId of directorIds) {
                    if (dirId !== actor.aid) {
                        await createNotification(
                            NOTIFICATION_TYPES.PROJECT_CREATED,
                            dirId,
                            actor.aid,
                            `Dự án mới được tạo: "${name}" (Phòng ban: ${dept.D_Name})`,
                            null,
                            projectId
                        );
                    }
                }

                // Notify Admins
                const adminIds = await getAccountsByRole('admin');
                for (const admId of adminIds) {
                    if (admId !== actor.aid) {
                        await createNotification(
                            NOTIFICATION_TYPES.PROJECT_CREATED,
                            admId,
                            actor.aid,
                            `Dự án mới được tạo: "${name}" (Phòng ban: ${dept.D_Name})`,
                            null,
                            projectId
                        );
                    }
                }

                console.log(`[NOTIFICATION] Project created: ${name} - notified ${directorIds.length} directors and ${adminIds.length} admins`);
            } catch (notifErr) {
                console.error("Failed to send project creation notifications:", notifErr.message);
            }

            // Log project creation
            try {
                const logService = (await import("./systemLogService.js")).default;
                logService.createLog('create_project', actor.aid, `Created project "${name}"`, 'Project', projectId);
            } catch (logErr) {
                console.error("Failed to log project creation:", logErr.message);
            }

            return { status: 201, data: newProject };
        } catch (err) {
            console.error("CREATE PROJECT ERROR:", err);
            return { status: 500, message: "Server error creating project" };
        }
    },

    // List Projects
    listProjects: async (req) => {
        try {
            const actor = req.user;
            const role = (actor.roleName || '').toLowerCase();
            const roleId = actor.roleId || '';
            const userDeptId = actor.departmentId;

            // STRICT RULE: Admin checks removed to allow visibility
            // if (role === 'admin' || role === 'system admin' || roleId === 'R_001') {
            //     return { status: 403, message: "..." };
            // }

            // Optional: filtering by Department or Status
            const { departmentId, status } = req.query;
            const where = { IsDeleted: false };

            // SECURITY SCOPING
            // If NOT PMO, NOT Director, AND NOT Admin -> restrict to User's Department
            /*
            if (role !== 'pmo' && !role.includes('director') && !role.includes('sep') && !role.includes('admin') && role !== 'system') {
                if (userDeptId) {
                    where.D_ID = userDeptId;
                } else {
                    // If user has no department, they technically shouldn't see projects? 
                    // Or maybe they are generic staff. Safest is to return empty if no department.
                    // But let's assume Members always have Departments.
                }
            }
            */

            // User filter overrides if strictly tighter? No, security filter overrides user filter.
            // If user passed departmentId, we use it IF it matches scoped D_ID (or if user is PMO).
            if (departmentId) {
                if (where.D_ID && where.D_ID !== departmentId) {
                    // Attempting to view another dept -> Empty result
                    return { status: 200, data: [] };
                }
                where.D_ID = departmentId;
            }
            if (status) where.Status = status;

            const projects = await prisma.project.findMany({
                where,
                include: {
                    Department: true,
                    Account: { select: { UserName: true } },
                    Task: {
                        where: { IsDeleted: false },
                        select: { Status: true, Progress: true }
                    }
                },
                orderBy: { P_ID: 'desc' }
            });

            // Calculate Progress
            const projectsWithProgress = projects.map(p => {
                const totalTasks = p.Task.length;
                let avgProgress = 0;
                if (totalTasks > 0) {
                    const sum = p.Task.reduce((acc, t) => acc + (t.Progress || 0), 0);
                    avgProgress = Math.round(sum / totalTasks);
                }
                return { ...p, Progress: avgProgress };
            });

            return { status: 200, data: projectsWithProgress };
        } catch (err) {
            console.error("LIST PROJECTS ERROR:", err);
            return { status: 500, message: "Server error listing projects" };
        }
    },

    // Get Project Detail
    getProject: async (req) => {
        try {
            const { id } = req.params;
            const project = await prisma.project.findUnique({
                where: { P_ID: id },
                include: {
                    Department: true,
                    Task: {
                        where: { IsDeleted: false },
                        select: { Status: true, Progress: true, T_ID: true } // Include T_ID for mapping if needed, but here just used for calculation or list
                    }
                }
            });

            if (!project || project.IsDeleted) {
                return { status: 404, message: "Project not found" };
            }

            // Calculate Progress
            const totalTasks = project.Task.length;
            let avgProgress = 0;
            if (totalTasks > 0) {
                const sum = project.Task.reduce((acc, t) => acc + (t.Progress || 0), 0);
                avgProgress = Math.round(sum / totalTasks);
            }
            const projectWithProgress = { ...project, Progress: avgProgress };

            return { status: 200, data: projectWithProgress };
        } catch (err) {
            console.error("GET PROJECT ERROR:", err);
            return { status: 500, message: "Server error getting project" };
        }
    },

    // Update Project
    updateProject: async (req) => {
        try {
            const { id } = req.params;
            const actor = req.user;
            const role = (actor.roleName || '').toLowerCase();
            const { name, departmentId, beginDate, endDate, status, description, managerId } = req.body;

            // ========================================
            // STRICT ROLE-BASED PERMISSION CHECK
            // ========================================
            const isPMO = role === 'pmo';
            const isDirector = role === 'director' || role === 'giám đốc';
            const isAdmin = role === 'admin' || role === 'system admin' || role === 'admin hệ thống';
            const isLeader = role === 'leader' || role === 'manager' || role === 'tp';
            const isStaff = role === 'staff' || role === 'nhân viên';

            // Admin and Staff cannot update projects
            if (isAdmin) {
                return { status: 403, message: "Admin hệ thống không tham gia vào workflow dự án." };
            }
            if (isStaff) {
                return { status: 403, message: "Nhân viên không có quyền chỉnh sửa dự án." };
            }
            if (isLeader) {
                return { status: 403, message: "Leader không có quyền chỉnh sửa dự án. Vui lòng liên hệ PMO." };
            }

            const project = await prisma.project.findUnique({ where: { P_ID: id } });
            if (!project || project.IsDeleted) {
                return { status: 404, message: "Project not found" };
            }

            // Director: Only allowed to approve/reject status
            if (isDirector) {
                const allowedDirectorStatuses = ['approved', 'rejected', 'closed'];
                if (status && allowedDirectorStatuses.includes(status)) {
                    const updated = await prisma.project.update({
                        where: { P_ID: id },
                        data: { Status: status },
                    });

                    // Log director approval
                    try {
                        const logService = (await import("./systemLogService.js")).default;
                        logService.createLog('project_approval', actor.aid, `Director ${status} project "${project.P_Name}"`, 'Project', id);
                    } catch (e) { console.error(e); }

                    // Send notifications to PMO and Leader
                    try {
                        const {
                            notifyProjectApproved,
                            notifyRole,
                            NOTIFICATION_TYPES,
                            MESSAGE_TEMPLATES
                        } = await import("./notificationService.js");

                        if (status === 'approved') {
                            // Notify PMO and Leader that project is approved
                            await notifyProjectApproved(project.P_Name, id, project.D_ID, actor.aid);
                            console.log(`[NOTIFICATION] Director approved project "${project.P_Name}" - notified PMO and Leaders`);
                        } else if (status === 'rejected') {
                            // Notify PMO that project is rejected
                            await notifyRole(
                                NOTIFICATION_TYPES.PROJECT_DIRECTOR_REJECTED,
                                'pmo',
                                actor.aid,
                                MESSAGE_TEMPLATES.PROJECT_DIRECTOR_REJECTED(project.P_Name),
                                { projectId: id }
                            );
                            console.log(`[NOTIFICATION] Director rejected project "${project.P_Name}" - notified PMO`);
                        }
                    } catch (notifErr) {
                        console.error("Failed to send project approval notification:", notifErr.message);
                    }

                    return { status: 200, data: updated, message: `Dự án đã được ${status === 'approved' ? 'phê duyệt' : status === 'rejected' ? 'từ chối' : 'đóng'}.` };
                } else {
                    return { status: 403, message: "Giám đốc chỉ có thể phê duyệt hoặc đóng dự án, không thể chỉnh sửa nội dung." };
                }
            }

            // PMO: Full edit access
            if (!isPMO) {
                return { status: 403, message: `Role '${role}' không có quyền chỉnh sửa dự án.` };
            }

            const data = {};
            if (name) data.P_Name = name;
            if (description) data.P_Description = description;
            if (departmentId) data.D_ID = departmentId;
            if (beginDate) data.Begin_Date = new Date(beginDate);
            if (endDate) data.End_Date = new Date(endDate);
            if (status) data.Status = status;
            if (managerId) data.Created_By_A_ID = managerId;

            const updated = await prisma.project.update({
                where: { P_ID: id },
                data,
            });

            return { status: 200, data: updated };
        } catch (err) {
            console.error("UPDATE PROJECT ERROR:", err);
            return { status: 500, message: "Server error updating project" };
        }
    },

    // Soft Delete Project
    deleteProject: async (req) => {
        try {
            const actor = req.user;
            const role = (actor.roleName || '').toLowerCase();
            const { id } = req.params;

            // PERMISSION CHECK
            // Only PMO can delete projects
            if (role !== 'pmo') {
                return { status: 403, message: "Access Denied: Only PMO can delete projects." };
            }

            const project = await prisma.project.findUnique({ where: { P_ID: id } });
            if (!project || project.IsDeleted) {
                return { status: 404, message: "Project not found" };
            }

            const deleted = await prisma.project.update({
                where: { P_ID: id },
                data: {
                    IsDeleted: true,
                    Deleted_At: new Date(),
                    Deleted_By: actor?.aid,
                    Status: "deleted"
                }
            });

            return { status: 200, data: deleted };
        } catch (err) {
            console.error("DELETE PROJECT ERROR:", err);
            return { status: 500, message: "Server error deleting project" };
        }
    }
};

export default projectServices;
