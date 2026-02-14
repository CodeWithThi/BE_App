import express from "express";
import projectController from "../controllers/projectController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const projectRouter = express.Router();

// Apply auth middleware to all project routes
projectRouter.use(authMiddleware.verifyToken);

projectRouter.post("/", projectController.createProject);
projectRouter.get("/", projectController.listProjects);
projectRouter.get("/:id", projectController.getProject);
projectRouter.put("/:id", projectController.updateProject);
projectRouter.delete("/:id", projectController.deleteProject);

export default projectRouter;
