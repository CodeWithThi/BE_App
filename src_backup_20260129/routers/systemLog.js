import express from "express";
import systemLogController from "../controllers/systemLogController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// Middleware: Require login for all log routes
router.use(authMiddleware.verifyToken);

router.get("/", systemLogController.getLogs);

export default router;
