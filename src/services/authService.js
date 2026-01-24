// src/services/authService.js
import prisma from "../config/database.js";
import { tokenService } from "./tokenService.js";
import bcrypt from "bcryptjs";

const authServices = {
  // ---------- F02: Đăng nhập ----------
  login: async (req) => {
    const { username, password } = req.body;

    console.log("LOGIN BODY:", { username, password });

    if (!username || !password) {
      return { status: 400, message: "Thiếu username/password" };
    }

    // ⚠️ DÙNG findUnique theo UserName (UserName là unique)
    const acc = await prisma.account.findUnique({
      where: {
        UserName: username,
      },
      include: {
        Role: true,   // đúng tên relation trong schema
        Member: true, // đúng tên relation trong schema
      },
    });

    console.log(
      "ACCOUNT FOUND:",
      acc
        ? {
          A_ID: acc.A_ID,
          UserName: acc.UserName,
          IsDeleted: acc.IsDeleted,
          PassWordPreview: acc.PassWord.slice(0, 20) + "...",
        }
        : null
    );

    if (!acc || acc.IsDeleted === true) {
      // không tìm thấy / đã xoá mềm
      return { status: 401, message: "Sai tài khoản hoặc mật khẩu" };
    }

    // So sánh bcrypt
    const isMatch = await bcrypt.compare(password, acc.PassWord);
    console.log("BCRYPT MATCH:", isMatch);

    if (!isMatch) {
      return { status: 401, message: "Sai tài khoản hoặc mật khẩu" };
    }

    const tokens = tokenService.createTokens(acc);
    const { PassWord, ...safeAcc } = acc;

    // Log the login action
    // We import logically at top, but for replace convenience we might use dynamic import or ensure import exists.
    // Let's add top level import if possible, or use dynamic import inside to avoid large change.
    // Dynamic import is safer for partial file replacement contexts if top is far away, but here we can just do it.
    // Better: Add top import in a separate tool call if needed, or assume I can add it if I see the file top.
    // I see the file top in context below (lines 1-4).

    // Actually, I'll use dynamic import to be safe and lazy, or just add the import at the top in a separate chunk?
    // Let's just use dynamic import for the service to avoid cyclic deps issues often found in node (though services usually OK).
    const logService = (await import("./systemLogService.js")).default;
    logService.createLog('login', safeAcc.A_ID, `User ${safeAcc.UserName} logged in`, 'Account', safeAcc.A_ID);

    return {
      status: 200,
      data: {
        user: safeAcc,
        tokens,
      },
    };
  },

  // ---------- F02: /auth/me ----------
  me: async (req) => {
    const { aid } = req.user;

    const acc = await prisma.account.findUnique({
      where: {
        A_ID: aid,
      },
      include: {
        Role: true,
        Member: true,
      },
    });

    if (!acc || acc.IsDeleted === true) {
      return { status: 404, message: "Không tìm thấy tài khoản" };
    }

    const { PassWord, ...safeAcc } = acc;
    return { status: 200, data: safeAcc };
  },

  // ---------- F03: Đổi mật khẩu ----------
  changePassword: async (req) => {
    const { aid } = req.user;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return { status: 400, message: "Thiếu oldPassword/newPassword" };
    }

    const acc = await prisma.account.findUnique({
      where: {
        A_ID: aid,
      },
    });

    if (!acc || acc.IsDeleted === true) {
      return { status: 404, message: "Không tìm thấy tài khoản" };
    }

    const isMatch = await bcrypt.compare(oldPassword, acc.PassWord);
    console.log("CHANGE PW – BCRYPT MATCH OLD:", isMatch);

    if (!isMatch) {
      return { status: 400, message: "Mật khẩu cũ không đúng" };
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.account.update({
      where: { A_ID: aid },
      data: { PassWord: hashed },
    });

    const changedAt = new Date().toISOString();

    return {
      status: 200,
      data: { success: true, changedAt },
    };
  },

  // ---------- F04: Quên mật khẩu ----------
  forgotPassword: async (req) => {
    const { email } = req.body;

    if (!email) {
      return { status: 400, message: "Vui lòng nhập email" };
    }

    // Find account by email (Email is in Account table, not Member)
    const account = await prisma.account.findFirst({
      where: {
        Email: email,
        IsDeleted: false,
      },
      include: {
        Member: true,
      },
    });

    // For security, always return success even if email not found
    if (!account) {
      console.log("Email not found:", email);
      return {
        status: 200,
        data: { message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi." },
      };
    }

    // Generate reset token (random + timestamp)
    const crypto = await import("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token in account
    await prisma.account.update({
      where: { A_ID: account.A_ID },
      data: {
        ResetToken: resetToken,
        ResetTokenExpires: resetExpires,
      },
    });

    // Send email
    const emailService = (await import("./emailService.js")).default;
    const fullName = account.Member?.FullName || account.UserName;
    const emailResult = await emailService.sendPasswordResetEmail(
      email,
      resetToken,
      fullName
    );

    if (!emailResult.success) {
      console.log("Failed to send reset email to:", email, emailResult.message);
    }

    return {
      status: 200,
      data: { message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi." },
    };
  },

  // ---------- F05: Đặt lại mật khẩu ----------
  resetPassword: async (req) => {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      return { status: 400, message: "Thiếu thông tin đặt lại mật khẩu" };
    }

    if (newPassword.length < 6) {
      return { status: 400, message: "Mật khẩu phải có ít nhất 6 ký tự" };
    }

    // Find account by email (Email is in Account table, not Member)
    const account = await prisma.account.findFirst({
      where: {
        Email: email,
        IsDeleted: false,
      },
    });

    if (!account) {
      return { status: 400, message: "Link đặt lại mật khẩu không hợp lệ" };
    }

    // Verify token and expiry
    if (account.ResetToken !== token) {
      return { status: 400, message: "Link đặt lại mật khẩu không hợp lệ" };
    }

    if (!account.ResetTokenExpires || new Date() > account.ResetTokenExpires) {
      return { status: 400, message: "Link đặt lại mật khẩu đã hết hạn" };
    }

    // Hash new password and update
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.account.update({
      where: { A_ID: account.A_ID },
      data: {
        PassWord: hashed,
        ResetToken: null,
        ResetTokenExpires: null,
      },
    });

    console.log("Password reset successful for:", email);

    return {
      status: 200,
      data: { message: "Đặt lại mật khẩu thành công" },
    };
  },
};

export default authServices;


