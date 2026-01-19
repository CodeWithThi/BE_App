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

// Checklist
taskRouter.post("/:id/checklist", taskController.addChecklistItem);
taskRouter.put("/checklist/:itemId", taskController.updateChecklistItem);
taskRouter.delete("/checklist/:itemId", taskController.deleteChecklistItem);

// Labels
taskRouter.post("/:id/labels", taskController.addLabel);
taskRouter.delete("/:id/labels/:labelId", taskController.removeLabel);

// Attachments
taskRouter.post("/:id/attachments", taskController.addAttachment);
taskRouter.delete("/:id/attachments/:attachmentId", taskController.deleteAttachment);

// Comments
taskRouter.post("/:id/comments", taskController.addComment);
taskRouter.delete("/:id/comments/:commentId", taskController.deleteComment);
taskRouter.put("/:id/comments/:commentId", taskController.updateComment);

export default taskRouter;
