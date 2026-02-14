import prisma from "../config/database.js";

const genReportId = () => {
    return "TR_" + Date.now().toString().slice(-4) + Math.floor(Math.random() * 100);
};

const taskReportService = {
    // Create Report
    createReport: async (req) => {
        try {
            const actor = req.user;
            const { taskId, content, progress, periodStart, periodEnd, periodType } = req.body;

            if (!taskId || !content) {
                return { status: 400, message: "Missing required fields: taskId, content" };
            }

            // Verify Task exists
            const task = await prisma.task.findUnique({
                where: { T_ID: taskId },
                include: { Task_Member: true }
            });

            if (!task || task.IsDeleted) {
                return { status: 404, message: "Task not found" };
            }

            // PERMISSION: Only Members of the task (or Admin/PMO) can report?
            // Usually Only Assigned Staff reports progress.
            const isMember = task.Task_Member.some(tm => tm.M_ID === actor.mid);
            const role = (actor.roleName || '').toLowerCase();
            const isAdmin = ['admin', 'pmo', 'leader', 'manager'].some(r => role.includes(r));

            if (!isMember && !isAdmin) {
                return { status: 403, message: "Access Denied: You are not assigned to this task." };
            }

            const newReport = await prisma.task_Report.create({
                data: {
                    TR_ID: genReportId(),
                    T_ID: taskId,
                    Content: content,
                    Progress: progress || '0%',
                    Period_Type: periodType || 'daily',
                    Period_Start: periodStart ? new Date(periodStart) : new Date(),
                    Period_End: periodEnd ? new Date(periodEnd) : new Date(),
                    Reporter_A_ID: actor.aid,
                    Created_By_A_ID: actor.aid,
                    Status: 'submitted',
                    IsDeleted: false
                }
            });

            return { status: 201, data: newReport };
        } catch (err) {
            console.error("CREATE REPORT ERROR:", err);
            return { status: 500, message: err.message };
        }
    },

    // List Reports for a Task
    listReportsByTask: async (req) => {
        try {
            const { taskId } = req.params;
            const reports = await prisma.task_Report.findMany({
                where: { T_ID: taskId, IsDeleted: false },
                include: {
                    Account_Task_Report_Reporter_A_IDToAccount: {
                        select: { UserName: true, Avatar: true, M_ID: true }
                    }
                },
                orderBy: { Period_Start: 'desc' }
            });
            return { status: 200, data: reports };
        } catch (err) { return { status: 500, message: err.message }; }
    },

    // Update Report
    updateReport: async (req) => {
        try {
            const { id } = req.params;
            const actor = req.user;
            const { content, progress, status } = req.body;

            const report = await prisma.task_Report.findUnique({ where: { TR_ID: id } });
            if (!report || report.IsDeleted) return { status: 404, message: "Report not found" };

            // PERMISSION: Only Reporter can edit? Or Leader?
            if (report.Reporter_A_ID !== actor.aid) {
                // Check if admin/leader
                const role = (actor.roleName || '').toLowerCase();
                const isAdmin = ['admin', 'pmo', 'leader'].some(r => role.includes(r));
                if (!isAdmin) return { status: 403, message: "Access Denied: Not your report" };
            }

            const data = {};
            if (content) data.Content = content;
            if (progress) data.Progress = progress;
            if (status) data.Status = status;

            const updated = await prisma.task_Report.update({
                where: { TR_ID: id },
                data
            });
            return { status: 200, data: updated };
        } catch (err) { return { status: 500, message: err.message }; }
    },

    // Delete Report
    deleteReport: async (req) => {
        try {
            const { id } = req.params;
            const actor = req.user;

            const report = await prisma.task_Report.findUnique({ where: { TR_ID: id } });
            if (!report || report.IsDeleted) return { status: 404, message: "Report not found" };

            if (report.Reporter_A_ID !== actor.aid) {
                const role = (actor.roleName || '').toLowerCase();
                const isAdmin = ['admin', 'pmo', 'leader'].some(r => role.includes(r));
                if (!isAdmin) return { status: 403, message: "Access Denied" };
            }

            await prisma.task_Report.update({
                where: { TR_ID: id },
                data: {
                    IsDeleted: true,
                    Deleted_At: new Date(),
                    Deleted_By: actor.aid
                }
            });
            return { status: 200, message: "Deleted" };
        } catch (err) { return { status: 500, message: err.message }; }
    }
};

export default taskReportService;
