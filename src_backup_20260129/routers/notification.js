// src/routers/notification.js
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import notificationController from "../controllers/notificationController.js";

const router = express.Router();

// GET /notifications
router.get("/", authMiddleware.verifyToken, async (req, res) => {
    const result = await notificationController.list(req);
    res.status(result.status).json(result);
});

// PUT /notifications/:id/read
router.put("/:id/read", authMiddleware.verifyToken, async (req, res) => {
    const result = await notificationController.read(req);
    res.status(result.status).json(result);
});

// PUT /notifications/read-all
router.put("/read-all", authMiddleware.verifyToken, async (req, res) => {
    const result = await notificationController.readAll(req);
    res.status(result.status).json(result);
});

// DELETE /notifications/:id
router.delete("/:id", authMiddleware.verifyToken, async (req, res) => {
    const result = await notificationController.delete(req);
    res.status(result.status).json(result);
});

export default router;
