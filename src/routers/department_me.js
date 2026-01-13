// src/routers/me.router.js
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import departmentController from "../controllers/departmentController.js";

const meRouter = express.Router();

// GET /api/v1/me/department
meRouter.get(
  "/department",
  authMiddleware.verifyToken,
  departmentController.myDepartment
);

export default meRouter;
