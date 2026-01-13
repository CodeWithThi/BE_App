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
};

export default taskController;
