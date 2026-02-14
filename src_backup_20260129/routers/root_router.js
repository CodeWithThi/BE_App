import express from "express";
import authRouter from "./auth.js";
import accountRouter from "./account.js";
import departmentRouter from "./department.js";
import meRouter from "./department_me.js";
import projectRouter from "./project.js";
import taskRouter from "./task.js";
import dashboardRouter from "./dashboard.js";
import settingsRouter from "./settings.js";
import uploadRouter from "./upload.js";
import notificationRouter from "./notification.js";
import systemLogRouter from "./systemLog.js";
import taskReportRouter from "./taskReport.js";

const rootRouter = express.Router();

rootRouter.use("/auth", authRouter);
rootRouter.use("/accounts", accountRouter);
rootRouter.use("/departments", departmentRouter);
rootRouter.use("/departments_me", meRouter);
rootRouter.use("/projects", projectRouter);
rootRouter.use("/tasks", taskRouter);
rootRouter.use("/dashboard", dashboardRouter);
rootRouter.use("/settings", settingsRouter);
rootRouter.use("/upload", uploadRouter);
rootRouter.use("/notifications", notificationRouter);
rootRouter.use("/system-logs", systemLogRouter);
rootRouter.use("/reports", taskReportRouter);

export default rootRouter;
