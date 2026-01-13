import prisma from "../config/database.js";

const genTaskId = () => {
    return "T_" + Date.now().toString().slice(-3) + Math.floor(Math.random() * 10);
};

const taskServices = {
    // Create Task
    createTask: async (req) => {
        try {
            const actor = req.user;
            console.log("DEBUG CREATE TASK - User:", actor);
            const { title, description, beginDate, dueDate, priority, projectId, assignedTo, parentTaskId } = req.body;
            console.log("DEBUG CREATE TASK - Body:", req.body);

            const role = (actor.roleName || '').toLowerCase();
            const roleId = actor.roleId || '';
            console.log("DEBUG CREATE TASK - RoleName:", role, "RoleID:", roleId);

            // PERMISSION CHECK
            // Allow commonly known roles and specific Role IDs (assuming R_001..R_005 are higher ranks)
            // Adjust Role IDs based on your actual DB seed
            const allowedRoles = ['pmo', 'leader', 'manager', 'admin', 'system admin', 'director', 'tp', 'qa'];
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

            // Verify Member if assigned
            if (assignedTo) {
                const member = await prisma.member.findUnique({ where: { M_ID: assignedTo } });
                if (!member || member.IsDeleted) {
                    console.error(`Assigned Member not found: ${assignedTo}`);
                    return { status: 404, message: `Người được phân công không tồn tại (ID: ${assignedTo})` };
                }
            }

            const taskId = genTaskId();
            const newTask = await prisma.task.create({
                data: {
                    T_ID: taskId,
                    Title: title,
                    Description: description,
                    Begin_Date: beginDate ? new Date(beginDate) : null,
                    Due_Date: dueDate ? new Date(dueDate) : null,
                    Priority: priority,
                    P_ID: projectId,
                    Assigned_ID_M_ID: assignedTo || null,
                    Parent_T_ID: parentTaskId || null,
                    Created_By_A_ID: actor?.aid,
                    Status: "pending", // Default status
                    IsDeleted: false,
                },
                include: {
                    Member: true,
                    Project: true,
                    Account: true
                }
            });

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
                    Member: { include: { Department: true } }, // Assigned Member with Department
                    Project: { include: { Department: true } }, // Project with Department
                    Account: { select: { UserName: true } } // Created By
                },
                orderBy: { Created_By_A_ID: 'desc' } // Just some order
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
                    Member: { include: { Department: true } }, // Also get Member's department
                    Project: { include: { Department: true } },
                    Subtasks: {
                        where: { IsDeleted: false },
                        include: {
                            Member: true
                        }
                    },
                    Task_Report: { where: { IsDeleted: false } }
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
            const { title, description, beginDate, dueDate, priority, assignedTo, status } = req.body;

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

            const updated = await prisma.task.update({
                where: { T_ID: id },
                data,
            });

            return { status: 200, data: updated };
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

            return { status: 200, data: deleted };
        } catch (err) {
            console.error("DELETE TASK ERROR:", err);
            return { status: 500, message: "Server error deleting task" };
        }
    }
};

export default taskServices;
