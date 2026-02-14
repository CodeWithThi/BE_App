import taskReportService from "../services/taskReportService.js";

const taskReportController = {
    createReport: async (req, res) => {
        const r = await taskReportService.createReport(req);
        return res.status(r.status).json(r);
    },
    listReportsByTask: async (req, res) => {
        const r = await taskReportService.listReportsByTask(req);
        return res.status(r.status).json(r);
    },
    updateReport: async (req, res) => {
        const r = await taskReportService.updateReport(req);
        return res.status(r.status).json(r);
    },
    deleteReport: async (req, res) => {
        const r = await taskReportService.deleteReport(req);
        return res.status(r.status).json(r);
    }
};

export default taskReportController;
