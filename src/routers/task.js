import express from "express";
import taskController from "../controllers/taskController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const taskRouter = express.Router();

taskRouter.use(authMiddleware.verifyToken);

taskRouter.post("/", taskController.createTask);
taskRouter.get("/", taskController.listTasks);
taskRouter.get("/:id", taskController.getTask);
taskRouter.put("/:id", taskController.updateTask);
taskRouter.delete("/:id", taskController.deleteTask);

export default taskRouter;
