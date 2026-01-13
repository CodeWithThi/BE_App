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
};

export default authServices;
