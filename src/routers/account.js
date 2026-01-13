// src/routers/account.router.js
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import accountController from "../controllers/accountController.js";

const accountRouter = express.Router();

// F01 – Tạo tài khoản
accountRouter.post(
  "/",
  authMiddleware.verifyToken,
  authMiddleware.authorize("ACCOUNT_CREATE"),
  accountController.createAccount
);

// (optional) list account
accountRouter.get(
  "/",
  authMiddleware.verifyToken,
  authMiddleware.authorize("ACCOUNT_LIST"),
  accountController.listAccounts
);

// F04 - Cập nhật thông tin
accountRouter.put(
  "/:A_ID",
  authMiddleware.verifyToken,
  authMiddleware.authorize("ACCOUNT_UPDATE"), // Ensure this permission exists or Admin has it
  accountController.updateAccount
);

// F05 – Khoá/Mở khoá tài khoản
accountRouter.put(
  "/:A_ID/status",
  authMiddleware.verifyToken,
  authMiddleware.authorize("ACCOUNT_STATUS"),
  accountController.changeStatus
);

// F06 – Xoá tài khoản (soft delete)
accountRouter.delete(
  "/:A_ID",
  authMiddleware.verifyToken,
  authMiddleware.authorize("ACCOUNT_DELETE"),
  accountController.softDelete
);

// F07 – Khôi phục tài khoản
accountRouter.post(
  "/:A_ID/restore",
  authMiddleware.verifyToken,
  authMiddleware.authorize("ACCOUNT_DELETE"), // Reusing DELETE permission for restore or create new one 'ACCOUNT_RESTORE'? Let's reuse for now or check permissions.js.
  accountController.restoreAccount
);

export default accountRouter;
