import projectServices from "../services/projectService.js";

const projectController = {
    createProject: async (req, res) => {
        const r = await projectServices.createProject(req);
        return res.status(r.status).json(r);
    },
    listProjects: async (req, res) => {
        const r = await projectServices.listProjects(req);
        return res.status(r.status).json(r);
    },
    getProject: async (req, res) => {
        const r = await projectServices.getProject(req);
        return res.status(r.status).json(r);
    },
    updateProject: async (req, res) => {
        const r = await projectServices.updateProject(req);
        return res.status(r.status).json(r);
    },
    deleteProject: async (req, res) => {
        const r = await projectServices.deleteProject(req);
        return res.status(r.status).json(r);
    },
};

export default projectController;
