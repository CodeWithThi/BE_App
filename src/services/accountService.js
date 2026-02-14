// src/services/accountService.js
import prisma from "../config/database.js";
import bcrypt from "bcryptjs";

const genAccountId = () => {
  return "A_" + Date.now().toString().slice(-3) + Math.floor(Math.random() * 10);
};

const genMemberId = () => {
  return "M_" + Date.now().toString().slice(-3) + Math.floor(Math.random() * 10);
};

const accountServices = {
  // ---------- F01: Tạo tài khoản ----------
  createAccount: async (req) => {
    try {
      const actor = req.user; // admin đang login
      const {
        username,
        password,
        fullName,
        email,
        phoneNumber,
        roleId,
        departmentId,
      } = req.body;

      if (!username || !password || !email || !roleId || !departmentId) {
        return { status: 400, message: "Thiếu trường bắt buộc" };
      }

      // check trùng username/email
      const existing = await prisma.account.findFirst({
        where: {
          OR: [{ UserName: username }, { Email: email }],
          IsDeleted: false,
        },
      });
      if (existing) {
        return { status: 400, message: "Username hoặc Email đã tồn tại" };
      }

      // tạo Member
      const memberId = genMemberId();
      const member = await prisma.member.create({
        data: {
          M_ID: memberId,
          FullName: fullName || username,
          PhoneNumber: phoneNumber || null,
          D_ID: departmentId,
          Status: "active",
          IsDeleted: false,
        },
      });

      // hash password
      const hashed = await bcrypt.hash(password, 10);

      // tạo Account
      const accountId = genAccountId();
      const account = await prisma.account.create({
        data: {
          A_ID: accountId,
          UserName: username,
          PassWord: hashed,
          Email: email,
          R_ID: roleId,
          M_ID: member.M_ID,
          Status: "active",
          IsDeleted: false,
        },
        include: {
          Role: true,
          Member: true,
        },
      });

      const { PassWord, ...safeAcc } = account;

      // Log the user creation
      const logService = (await import("./systemLogService.js")).default;
      logService.createLog('user_create', actor?.aid || 'system', `Created user ${username}`, 'Account', accountId);

      // Notify admin about new user
      const { createNotification, getAccountsByRole, NOTIFICATION_TYPES } = await import("./notificationService.js");
      const adminIds = await getAccountsByRole('admin');
      adminIds.forEach(adminId => {
        if (adminId !== actor?.aid) {
          createNotification(NOTIFICATION_TYPES.USER_ADDED, adminId, actor?.aid, `Người dùng mới được tạo: ${username}`, null, null);
        }
      });

      return {
        status: 201,
        data: {
          account: safeAcc,
          createdBy: actor?.aid || null,
        },
      };
    } catch (err) {
      console.error("CREATE ACCOUNT ERROR:", err);
      return { status: 500, message: "Lỗi server khi tạo tài khoản" };
    }
  },

  // (optional) list accounts để admin xem
  // (optional) list accounts để admin xem
  listAccounts: async (req) => {
    const {
      page = 1,
      limit = 50,  // Increased from 10 to 50
      search,
      roleId,
      departmentId,
      status, // 'active', 'inactive'
      includeDeleted
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {};

    // Filter by deletion status and Status field
    if (status === 'deleted') {
      // Only show deleted users
      where.IsDeleted = true;
    } else if (status === 'active' || status === 'inactive') {
      // Show active/inactive non-deleted users
      where.IsDeleted = false;
      where.Status = status;
    } else if (status === 'all') {
      // Show all non-deleted users
      where.IsDeleted = false;
    } else if (!status) {
      // Default: show only non-deleted
      where.IsDeleted = false;
    }

    // Using Prisma to filter active/inactive accounts works on Account.Status.

    // Filter by Role
    if (roleId && roleId !== 'all') {
      where.R_ID = roleId;
    }

    // Filter by Department (Relation Member -> D_ID)
    if (departmentId && departmentId !== 'all') {
      where.Member = {
        D_ID: departmentId
      };
    }

    // Search
    if (search) {
      where.OR = [
        { UserName: { contains: search } }, // Case-insensitive works depending on DB collation
        { Email: { contains: search } },
        {
          Member: {
            FullName: { contains: search }
          }
        }
      ];
    }

    // Get total count for pagination
    const total = await prisma.account.count({ where });

    const accounts = await prisma.account.findMany({
      where,
      skip,
      take,
      include: {
        Role: true,
        Member: {
          include: {
            Department: true
          }
        }
      },
      orderBy: { A_ID: 'desc' } // Sort by ID descending (newest first)
    });

    const safe = accounts.map(({ PassWord, ...rest }) => rest);

    return {
      status: 200,
      data: safe,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    };
  },

  // ---------- F04: Cập nhật tài khoản ----------
  updateAccount: async (req) => {
    try {
      const { aid: actorAid } = req.user;
      const { A_ID } = req.params;
      const {
        fullName,
        email,
        phoneNumber,
        roleId,
        departmentId,
        status, // 'active', 'inactive'
      } = req.body;

      if (!A_ID) {
        return { status: 400, message: "Thiếu A_ID" };
      }

      const acc = await prisma.account.findUnique({
        where: { A_ID },
        include: { Member: true }
      });

      if (!acc) {
        return { status: 404, message: "Tài khoản không tồn tại" };
      }

      // Check duplicate email if changed
      if (email && email !== acc.Email) {
        const existing = await prisma.account.findFirst({
          where: {
            Email: email,
            NOT: { A_ID },
            IsDeleted: false,
          },
        });
        if (existing) {
          return { status: 400, message: "Email đã được sử dụng bởi tài khoản khác" };
        }
      }

      const dataToUpdate = {
        Email: email,
        Status: status === 'inactive' ? 'inactive' : (status === 'active' ? 'active' : undefined),
        Member: {
          update: {
            FullName: fullName,
            PhoneNumber: phoneNumber,
            D_ID: departmentId,
          }
        }
      };

      if (roleId) {
        dataToUpdate.Role = {
          connect: { R_ID: roleId }
        };
      }

      // Update Account and Member
      const updated = await prisma.account.update({
        where: { A_ID },
        data: dataToUpdate,
        include: { Role: true, Member: true },
      });

      // Log the update
      const logService = (await import("./systemLogService.js")).default;
      logService.createLog('user_update', actorAid, `Updated user ${updated.UserName}`, 'Account', A_ID);

      const { PassWord, ...safeAcc } = updated;
      return {
        status: 200,
        data: {
          account: safeAcc,
          updatedBy: actorAid,
        },
      };
    } catch (err) {
      console.error("UPDATE ACCOUNT ERROR:", err);
      return { status: 500, message: "Lỗi server: " + (err.message || err.toString()) };
    }
  },

  // ---------- F05: Khoá / Mở khoá ----------
  changeStatus: async (req) => {
    try {
      const { aid: actorAid } = req.user;
      const { A_ID } = req.params;
      const { status, reason } = req.body; // status: 'locked' | 'active'

      if (!A_ID || !status) {
        return { status: 400, message: "Thiếu A_ID/status" };
      }

      const acc = await prisma.account.findUnique({
        where: { A_ID },
      });

      if (!acc || acc.IsDeleted) {
        return { status: 404, message: "Tài khoản không tồn tại" };
      }

      const updated = await prisma.account.update({
        where: { A_ID },
        data: {
          Status: status,
          // DB hiện tại không có cột reason, nên tạm thời chỉ log ra console
        },
        include: { Role: true, Member: true },
      });

      console.log("CHANGE STATUS reason:", reason);

      const { PassWord, ...safeAcc } = updated;
      return {
        status: 200,
        data: {
          account: safeAcc,
          changedBy: actorAid,
        },
      };
    } catch (err) {
      console.error("CHANGE STATUS ERROR:", err);
      return { status: 500, message: "Lỗi server khi cập nhật trạng thái" };
    }
  },

  // ---------- F06: Xoá tài khoản (soft delete) ----------
  softDelete: async (req) => {
    try {
      const { aid: actorAid } = req.user;
      const { A_ID } = req.params;

      if (!A_ID) {
        return { status: 400, message: "Thiếu A_ID" };
      }

      const acc = await prisma.account.findUnique({
        where: { A_ID },
      });

      if (!acc || acc.IsDeleted) {
        return { status: 404, message: "Tài khoản không tồn tại" };
      }

      const now = new Date();

      const deleted = await prisma.account.update({
        where: { A_ID },
        data: {
          IsDeleted: true,
          Deleted_At: now,
          Deleted_By: actorAid,
          Status: "inactive",
        },
        include: { Role: true, Member: true },
      });

      // Log the deletion
      const logService = (await import("./systemLogService.js")).default;
      logService.createLog('user_delete', actorAid, `Deleted user ${deleted.UserName}`, 'Account', A_ID);

      const { PassWord, ...safeAcc } = deleted;
      return {
        status: 200,
        data: safeAcc,
      };
    } catch (err) {
      console.error("SOFT DELETE ERROR:", err);
      return { status: 500, message: "Lỗi server khi xoá tài khoản" };
    }
  },
  // ---------- F07: Khôi phục tài khoản (restore) ----------
  restoreAccount: async (req) => {
    try {
      const { aid: actorAid } = req.user;
      const { A_ID } = req.params;

      if (!A_ID) {
        return { status: 400, message: "Thiếu A_ID" };
      }

      const acc = await prisma.account.findUnique({
        where: { A_ID },
      });

      if (!acc) {
        return { status: 404, message: "Tài khoản không tồn tại" };
      }

      const updated = await prisma.account.update({
        where: { A_ID },
        data: {
          IsDeleted: false,
          Status: "active", // Restore to active? Or keep inactive? Usually restore implies making it usable again.
          Deleted_At: null,
          Deleted_By: null,
        },
        include: { Role: true, Member: true },
      });

      // Log the restore
      const logService = (await import("./systemLogService.js")).default;
      logService.createLog('user_restore', actorAid, `Restored user ${updated.UserName}`, 'Account', A_ID);

      const { PassWord, ...safeAcc } = updated;
      return {
        status: 200,
        data: safeAcc,
      };
    } catch (err) {
      console.error("RESTORE ACCOUNT ERROR:", err);
      return { status: 500, message: "Lỗi server khi khôi phục tài khoản" };
    }
  },
};

export default accountServices;
// ✔ Check quyền theo permission
// if (roleName !== "admin" && !rolePermissions.includes(required)) {
//   return res.status(403).json({ message: "Không có quyền" });
// }
