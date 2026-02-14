// src/middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_SECRET } from "../common/constant/app.constant.js";
import prisma from "../config/database.js";

export const authMiddleware = {
  // verifyToken giữ như cũ, chỉ nhắc lại cho đầy đủ
  verifyToken: async (req, res, next) => {
    try {
      const authHeader =
        req.headers.authorization || req.headers.Authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Thiếu token" });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({ message: "Token không hợp lệ" });
      }

      console.log("VERIFY TOKEN RAW:", token);

      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
      console.log("DECODED JWT:", decoded);

      const { aid } = decoded;

      const acc = await prisma.account.findUnique({
        where: { A_ID: aid },
        include: {
          Role: true,
          Member: true,
        },
      });

      if (!acc || acc.IsDeleted === true) {
        return res.status(404).json({ message: "Tài khoản không tồn tại" });
      }

      req.user = {
        aid: acc.A_ID,
        roleId: acc.R_ID,
        roleName: acc.Role?.R_Name,
        departmentId: acc.Member?.D_ID || null,
        mid: acc.Member?.M_ID || null,
      };

      // Update Last_Active timestamp (non-blocking)
      prisma.account.update({
        where: { A_ID: acc.A_ID },
        data: { Last_Active: new Date() }
      }).catch(err => console.error('Failed to update Last_Active:', err));

      return next();
    } catch (e) {
      console.error("JWT VERIFY ERROR:", e);
      if (e.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token hết hạn" });
      }
      return res.status(401).json({ message: "Token không hợp lệ" });
    }
  },

  // cho tiện, vẫn giữ isAdmin
  isAdmin: (req, res, next) => {
    const roleName = (req.user?.roleName || "").toLowerCase();
    const roleId = req.user?.roleId;

    // Check various admin role names
    const isAdminRole =
      roleId === "R_001" ||
      roleName === "admin" ||
      roleName.includes("admin") ||
      roleName === "admin hệ thống" ||
      roleName === "admin system";

    if (isAdminRole) {
      return next();
    }
    return res.status(403).json({ message: "Không có quyền" });
  },

  // Authorize theo permissionKey
  authorize:
    (required) =>
      (req, res, next) => {
        const roleName = (req.user?.roleName || "").toLowerCase();
        const roleId = req.user?.roleId;

        if (!roleId) {
          return res.status(403).json({ message: "Không có quyền" });
        }

        // admin (R_001 or any admin-like role) full quyền
        const isAdminRole =
          roleId === "R_001" ||
          roleName === "admin" ||
          roleName.includes("admin") ||
          roleName === "admin hệ thống" ||
          roleName === "admin system";

        if (isAdminRole) {
          return next();
        }

        // Map role -> list permission
        const rolePermissions = {
          admin: [
            "DEPARTMENT_LIST",
            "DEPARTMENT_CREATE",
            "DEPARTMENT_UPDATE",
            "DEPARTMENT_DELETE",
            "ACCOUNT_LIST",
            "ACCOUNT_CREATE",
            "ACCOUNT_UPDATE",
            "ACCOUNT_DELETE",
            "ACCOUNT_STATUS",
          ],
          // system: kỹ thuật
          system: [
            "DEPARTMENT_LIST",
            "DEPARTMENT_CREATE",
            "DEPARTMENT_UPDATE",
            "DEPARTMENT_DELETE",
            "ACCOUNT_LIST",
            "ACCOUNT_CREATE",
            "ACCOUNT_UPDATE",
            "ACCOUNT_DELETE",
            "ACCOUNT_STATUS",
          ],
          // PMO
          pmo: ["DEPARTMENT_LIST", "ACCOUNT_LIST"],
          // manager / leader / director (sếp)
          manager: ["DEPARTMENT_LIST", "ACCOUNT_LIST"],
          leader: ["DEPARTMENT_LIST", "ACCOUNT_LIST"],
          director: ["DEPARTMENT_LIST", "ACCOUNT_LIST"],
          // staff (user) – không được list toàn bộ
          user: [],
          staff: [],
        };

        const perms = rolePermissions[roleName] || [];

        // nếu role có quyền tương ứng
        if (perms.includes(required)) {
          return next();
        }

        return res.status(403).json({ message: "Không có quyền" });
      },
};

export default authMiddleware;
