// src/routers/department.router.js
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import departmentController from "../controllers/departmentController.js";

const departmentRouter = express.Router();

// F07 – tạo phòng ban
departmentRouter.post(
  "/",
  authMiddleware.verifyToken,
  authMiddleware.authorize("DEPARTMENT_CREATE"),
  departmentController.create
);

// F07 – danh sách phòng ban (admin + sếp + PMO + leader/system/sep)
departmentRouter.get(
  "/",
  authMiddleware.verifyToken,
  authMiddleware.authorize("DEPARTMENT_LIST"),
  departmentController.list
);

// ✅ xem chi tiết 1 phòng ban
// admin/PMO/manager/sep/system: xem được tất cả
// staff(user): chỉ xem được phòng ban của chính mình
departmentRouter.get(
  "/:D_ID",
  authMiddleware.verifyToken,
  departmentController.detail
);

// F07 – cập nhật phòng ban
departmentRouter.put(
  "/:D_ID",
  authMiddleware.verifyToken,
  authMiddleware.authorize("DEPARTMENT_UPDATE"),
  departmentController.update
);

// F07 – xoá mềm phòng ban
departmentRouter.delete(
  "/:D_ID",
  authMiddleware.verifyToken,
  authMiddleware.authorize("DEPARTMENT_DELETE"),
  departmentController.softDelete
);

export default departmentRouter;
