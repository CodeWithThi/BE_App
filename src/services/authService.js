// src/services/authService.js
import prisma from "../config/database.js";
import { tokenService } from "./tokenService.js";
import bcrypt from "bcryptjs";
import settingsService from "./settingsService.js";

// Password validation helper
const validateStrongPassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (password.length < minLength) {
    return { valid: false, message: "Mật khẩu phải có ít nhất 8 ký tự" };
  }
  if (!hasUpperCase) {
    return { valid: false, message: "Mật khẩu phải có ít nhất 1 chữ hoa" };
  }
  if (!hasLowerCase) {
    return { valid: false, message: "Mật khẩu phải có ít nhất 1 chữ thường" };
  }
  if (!hasNumber) {
    return { valid: false, message: "Mật khẩu phải có ít nhất 1 số" };
  }
  return { valid: true };
};

const authServices = {
  // ---------- F02: Đăng nhập ----------
  login: async (req) => {
    const { username, password } = req.body;

    console.log("LOGIN BODY:", { username, password });

    if (!username || !password) {
      return { status: 400, message: "Thiếu username/password" };
    }

    // Get security settings
    let securitySettings = { lockAccount: true, rotatePassword: false };
    try {
      securitySettings = await settingsService.getSettings();
    } catch (e) {
      console.log("Could not load security settings, using defaults");
    }

    // Find account
    const acc = await prisma.account.findUnique({
      where: {
        UserName: username,
      },
      include: {
        Role: true,
        Member: {
          include: {
            Department: true
          }
        },
      },
    });

    console.log(
      "ACCOUNT FOUND:",
      acc
        ? {
          A_ID: acc.A_ID,
          UserName: acc.UserName,
          IsDeleted: acc.IsDeleted,
          FailedLoginAttempts: acc.FailedLoginAttempts,
          LockedUntil: acc.LockedUntil,
          PassWordPreview: acc.PassWord.slice(0, 20) + "...",
        }
        : null
    );

    if (!acc || acc.IsDeleted === true) {
      return { status: 401, message: "Sai tài khoản hoặc mật khẩu" };
    }

    // Check if account is locked
    if (securitySettings.lockAccount && acc.LockedUntil) {
      const now = new Date();
      if (acc.LockedUntil > now) {
        const remainingMinutes = Math.ceil((acc.LockedUntil - now) / (1000 * 60));
        return {
          status: 423,
          message: `Tài khoản đã bị khóa. Vui lòng thử lại sau ${remainingMinutes} phút.`
        };
      }
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, acc.PassWord);
    console.log("BCRYPT MATCH:", isMatch);

    if (!isMatch) {
      // Handle failed login attempt
      if (securitySettings.lockAccount) {
        const newFailedAttempts = (acc.FailedLoginAttempts || 0) + 1;
        const updateData = { FailedLoginAttempts: newFailedAttempts };

        // Lock account after 5 failed attempts
        if (newFailedAttempts >= 5) {
          updateData.LockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          await prisma.account.update({
            where: { A_ID: acc.A_ID },
            data: updateData,
          });
          return {
            status: 423,
            message: "Tài khoản đã bị khóa sau 5 lần đăng nhập sai. Vui lòng thử lại sau 30 phút."
          };
        }

        await prisma.account.update({
          where: { A_ID: acc.A_ID },
          data: updateData,
        });

        const remainingAttempts = 5 - newFailedAttempts;
        return {
          status: 401,
          message: `Sai mật khẩu. Còn ${remainingAttempts} lần thử trước khi tài khoản bị khóa.`
        };
      }

      return { status: 401, message: "Sai tài khoản hoặc mật khẩu" };
    }

    // Reset failed attempts on successful login
    if (acc.FailedLoginAttempts > 0 || acc.LockedUntil) {
      await prisma.account.update({
        where: { A_ID: acc.A_ID },
        data: {
          FailedLoginAttempts: 0,
          LockedUntil: null
        },
      });
    }

    // Check password rotation requirement
    let passwordExpired = false;
    if (securitySettings.rotatePassword && acc.LastPasswordChange) {
      const daysSinceChange = Math.floor(
        (Date.now() - new Date(acc.LastPasswordChange).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceChange >= 90) {
        passwordExpired = true;
      }
    }

    const tokens = tokenService.createTokens(acc);
    const { PassWord, ...safeAcc } = acc;

    // Log the login action
    const logService = (await import("./systemLogService.js")).default;
    logService.createLog('login', safeAcc.A_ID, `User ${safeAcc.UserName} logged in`, 'Account', safeAcc.A_ID);

    return {
      status: 200,
      data: {
        user: safeAcc,
        tokens,
        passwordExpired, // Frontend can use this to show a warning/redirect
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
        Member: {
          include: {
            Department: true
          }
        },
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

    // Get security settings
    let securitySettings = { strongPassword: true };
    try {
      securitySettings = await settingsService.getSettings();
    } catch (e) {
      console.log("Could not load security settings, using defaults");
    }

    // Validate strong password if enabled
    if (securitySettings.strongPassword) {
      const validation = validateStrongPassword(newPassword);
      if (!validation.valid) {
        return { status: 400, message: validation.message };
      }
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
      data: {
        PassWord: hashed,
        LastPasswordChange: new Date(), // Track password change date
      },
    });

    // Log the password change
    const logService = (await import("./systemLogService.js")).default;
    logService.createLog('password_change', aid, `User ${acc.UserName} changed password`, 'Account', aid);

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

    // Get security settings
    let securitySettings = { strongPassword: true };
    try {
      securitySettings = await settingsService.getSettings();
    } catch (e) {
      console.log("Could not load security settings, using defaults");
    }

    // Validate strong password if enabled
    if (securitySettings.strongPassword) {
      const validation = validateStrongPassword(newPassword);
      if (!validation.valid) {
        return { status: 400, message: validation.message };
      }
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
        LastPasswordChange: new Date(), // Track password change date
        FailedLoginAttempts: 0, // Reset failed attempts
        LockedUntil: null, // Unlock account
      },
    });

    console.log("Password reset successful for:", email);

    return {
      status: 200,
      data: { message: "Đặt lại mật khẩu thành công" },
    };
  },

  // ---------- F06: Cập nhật Profile (SĐT) ----------
  updateProfile: async (req) => {
    const { mid } = req.user;
    const { phoneNumber, phone } = req.body;
    const finalPhone = phoneNumber || phone;

    if (!mid) {
      return { status: 400, message: "Tài khoản không liên kết với thông tin thành viên" };
    }

    if (!finalPhone) {
      return { status: 400, message: "Thiếu số điện thoại" };
    }

    try {
      await prisma.member.update({
        where: { M_ID: mid },
        data: { PhoneNumber: finalPhone },
      });

      // Log the action
      const logService = (await import("./systemLogService.js")).default;
      await logService.createLog(
        logService.LOG_ACTIONS.USER_UPDATE,
        req.user.aid,
        `Cập nhật số điện thoại thành: ${finalPhone}`,
        'Member',
        mid
      );

      return {
        status: 200,
        data: { message: "Cập nhật thông tin thành công" },
      };
    } catch (error) {
      console.error("Update profile error:", error);
      return { status: 500, message: "Lỗi cập nhật thông tin" };
    }
  },
};

export default authServices;
