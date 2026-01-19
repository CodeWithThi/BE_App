import taskServices from "../services/taskService.js";

const taskController = {
    createTask: async (req, res) => {
        const r = await taskServices.createTask(req);
        return res.status(r.status).json(r);
    },
    listTasks: async (req, res) => {
        const r = await taskServices.listTasks(req);
        return res.status(r.status).json(r);
    },
    getTask: async (req, res) => {
        const r = await taskServices.getTask(req);
        return res.status(r.status).json(r);
    },
    updateTask: async (req, res) => {
        const r = await taskServices.updateTask(req);
        return res.status(r.status).json(r);
    },
    deleteTask: async (req, res) => {
        const r = await taskServices.deleteTask(req);
        return res.status(r.status).json(r);
    },
    // Checklist
    addChecklistItem: async (req, res) => {
        const r = await taskServices.addChecklistItem(req);
        return res.status(r.status).json(r);
    },
    updateChecklistItem: async (req, res) => {
        const r = await taskServices.updateChecklistItem(req);
        return res.status(r.status).json(r);
    },
    deleteChecklistItem: async (req, res) => {
        const r = await taskServices.deleteChecklistItem(req);
        return res.status(r.status).json(r);
    },
    // Label
    addLabel: async (req, res) => {
        const r = await taskServices.addLabel(req);
        return res.status(r.status).json(r);
    },
    removeLabel: async (req, res) => {
        const r = await taskServices.removeLabel(req);
        return res.status(r.status).json(r);
    },
    // Attachment
    addAttachment: async (req, res) => {
        const r = await taskServices.addAttachment(req);
        return res.status(r.status).json(r);
    },
    deleteAttachment: async (req, res) => {
        const r = await taskServices.deleteAttachment(req);
        return res.status(r.status).json(r);
    },
    // Comments
    addComment: async (req, res) => {
        const r = await taskServices.addComment(req);
        return res.status(r.status).json(r);
    },
    deleteComment: async (req, res) => {
        const r = await taskServices.deleteComment(req);
        return res.status(r.status).json(r);
    },
    updateComment: async (req, res) => {
        const r = await taskServices.updateComment(req);
        return res.status(r.status).json(r);
    },
};

export default taskController;
