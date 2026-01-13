
import express from "express";
import settingsController from "../controllers/settingsController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const settingsRouter = express.Router();

settingsRouter.get("/", authMiddleware.verifyToken, settingsController.getSettings);
settingsRouter.put("/", authMiddleware.verifyToken, authMiddleware.isAdmin, settingsController.updateSettings);

export default settingsRouter;
