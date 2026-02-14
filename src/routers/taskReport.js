import express from "express";
import taskReportController from "../controllers/taskReportController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const taskReportRouter = express.Router();

taskReportRouter.use(authMiddleware.verifyToken);

// Determine routes:
// Standard REST: POST /reports, GET /tasks/:id/reports? 
// Or Reports resource? 
// Let's use /reports as base resource, and passing taskId in Body for creation, or filter by query.
// But usually sub-resource is cleaner.
// user requested AG-01: POST /tasks/:id/reports (in test case)
// Let's support both or stick to one. 
// Ideally "TaskRouter" should mount this? 
// Or "ReportRouter".
// Let's try to map:
// POST / (body includes taskId) -> Create
// GET /task/:taskId -> List
// PUT /:id -> Update
// DELETE /:id -> Delete

taskReportRouter.post("/", taskReportController.createReport);
taskReportRouter.get("/task/:taskId", taskReportController.listReportsByTask);
taskReportRouter.put("/:id", taskReportController.updateReport);
taskReportRouter.delete("/:id", taskReportController.deleteReport);

export default taskReportRouter;
