import express from "express";
import dashboardController from "../controllers/dashboardController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const dashboardRouter = express.Router();

dashboardRouter.use(authMiddleware.verifyToken);

dashboardRouter.get("/stats", dashboardController.getStats);

export default dashboardRouter;
