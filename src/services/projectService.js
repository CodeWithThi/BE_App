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
                    D_ID: departmentId,
                    Begin_Date: beginDate ? new Date(beginDate) : null,
                    End_Date: endDate ? new Date(endDate) : null,
                    Created_By_A_ID: actor?.aid,
                    Status: "active",
                    IsDeleted: false,
                },
            });

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

            // STRICT RULE: Admin/System Admin cannot view projects
            // "Admin hệ thống lại xem được dự án vậy cậu làm lố rồi"
            if (role === 'admin' || role === 'system admin' || roleId === 'R_001') {
                return { status: 403, message: "Admin không thể xem danh sách dự án (Chỉ dành cho PMO/Leader/Staff)" };
            }

            // Optional: filtering by Department or Status
            const { departmentId, status } = req.query;
            const where = { IsDeleted: false };
            if (departmentId) where.D_ID = departmentId;
            if (status) where.Status = status;

            const projects = await prisma.project.findMany({
                where,
                include: { Department: true, Account: { select: { UserName: true } } }, // Created By
                orderBy: { Begin_Date: 'desc' }
            });

            return { status: 200, data: projects };
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
                include: { Department: true, Task: { where: { IsDeleted: false } } }
            });

            if (!project || project.IsDeleted) {
                return { status: 404, message: "Project not found" };
            }

            return { status: 200, data: project };
        } catch (err) {
            console.error("GET PROJECT ERROR:", err);
            return { status: 500, message: "Server error getting project" };
        }
    },

    // Update Project
    updateProject: async (req) => {
        try {
            const { id } = req.params;
            const { name, departmentId, beginDate, endDate, status } = req.body;

            const project = await prisma.project.findUnique({ where: { P_ID: id } });
            if (!project || project.IsDeleted) {
                return { status: 404, message: "Project not found" };
            }

            const data = {};
            if (name) data.P_Name = name;
            if (departmentId) data.D_ID = departmentId;
            if (beginDate) data.Begin_Date = new Date(beginDate);
            if (endDate) data.End_Date = new Date(endDate);
            if (status) data.Status = status;

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
            const { id } = req.params;

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
