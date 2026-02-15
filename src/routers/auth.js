// src/routers/auth.router.js
import express from "express";
import authController from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/rateLimiter.js";


const authRouter = express.Router();

// F02 – Login JWT (rate limited: 10 req/min)
authRouter.post("/login", authLimiter, authController.login);

// F02 – /auth/me
authRouter.get("/me", authMiddleware.verifyToken, authController.me);

// F03 – Đổi mật khẩu
authRouter.post(
  "/change-password",
  authMiddleware.verifyToken,
  authController.changePassword
);

// F04 – Quên mật khẩu (gửi email reset)
authRouter.post("/forgot-password", authLimiter, authController.forgotPassword);

// F05 – Đặt lại mật khẩu (với token)
authRouter.post("/reset-password", authLimiter, authController.resetPassword);

// F06 – Cập nhật thông tin cá nhân (SĐT)
authRouter.put("/profile", authMiddleware.verifyToken, authController.updateProfile);

export default authRouter;

