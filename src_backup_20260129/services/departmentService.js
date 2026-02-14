// src/services/departmentService.js
import prisma from "../config/database.js";

const genDepartmentId = () => {
  return "D_" + Date.now().toString().slice(-3) + Math.floor(Math.random() * 10);
};

const departmentServices = {
  // tạo phòng ban
  createDepartment: async (req) => {
    try {
      const { aid: actorAid } = req.user;
      const { name, parentId, status, id: providedId } = req.body; // status, id optional

      if (!name) return { status: 400, message: "Thiếu tên phòng ban" };

      // STRICT UNIQUE CHECK
      const existingName = await prisma.department.findFirst({
        where: { D_Name: name, IsDeleted: false }
      });
      if (existingName) {
        return { status: 400, message: `Tên phòng ban '${name}' đã tồn tại. Vui lòng chọn tên khác.` };
      }

      // If ID provided, check uniqueness
      if (providedId) {
        const existingId = await prisma.department.findUnique({ where: { D_ID: providedId } });
        if (existingId) {
          return { status: 400, message: `Mã phòng ban '${providedId}' đã tồn tại.` };
        }
      }

      const id = providedId || genDepartmentId();
      const dep = await prisma.department.create({
        data: {
          D_ID: id,
          D_Name: name,
          Parent_D_ID: parentId || null,
          Status: status || "active",
          IsDeleted: false,
        },
      });

      return {
        status: 201,
        data: {
          department: dep,
          createdBy: actorAid,
        },
      };
    } catch (err) {
      console.error("CREATE DEPARTMENT ERROR:", err);
      return { status: 500, message: "Lỗi server khi tạo phòng ban" };
    }
  },

  // cập nhật phòng ban
  updateDepartment: async (req) => {
    try {
      const { D_ID } = req.params;
      const { name, parentId, status } = req.body;

      const dep = await prisma.department.findUnique({
        where: { D_ID },
      });
      if (!dep || dep.IsDeleted) {
        return { status: 404, message: "Phòng ban không tồn tại" };
      }

      const updated = await prisma.department.update({
        where: { D_ID },
        data: {
          D_Name: name ?? dep.D_Name,
          Parent_D_ID: parentId ?? dep.Parent_D_ID,
          Status: status ?? dep.Status,
        },
      });

      return { status: 200, data: updated };
    } catch (err) {
      console.error("UPDATE DEPARTMENT ERROR:", err);
      return { status: 500, message: "Lỗi server khi cập nhật phòng ban" };
    }
  },

  // xoá mềm phòng ban
  softDeleteDepartment: async (req) => {
    try {
      const { aid: actorAid } = req.user;
      const { D_ID } = req.params;

      const dep = await prisma.department.findUnique({
        where: { D_ID },
      });
      if (!dep || dep.IsDeleted) {
        return { status: 404, message: "Phòng ban không tồn tại" };
      }

      const now = new Date();

      const deleted = await prisma.department.update({
        where: { D_ID },
        data: {
          IsDeleted: true,
          Deleted_At: now,
          Deleted_By: actorAid,
          Status: "inactive",
        },
      });

      return { status: 200, data: deleted };
    } catch (err) {
      console.error("DELETE DEPARTMENT ERROR:", err);
      return { status: 500, message: "Lỗi server khi xoá phòng ban" };
    }
  },

  // ✅ danh sách phòng ban
  listDepartments: async () => {
    try {
      const deps = await prisma.department.findMany({
        where: { IsDeleted: false },
        include: {
          _count: {
            select: { Member: true, Project: true }
          }
        }
      });
      return { status: 200, data: deps };
    } catch (err) {
      console.error("LIST DEPARTMENTS ERROR:", err);
      return { status: 500, message: "Lỗi server khi lấy danh sách phòng ban" };
    }
  },

  // ✅ chi tiết 1 phòng ban
  getDepartmentById: async (req) => {
    try {
      const { D_ID } = req.params;
      const roleName = (req.user?.roleName || "").toLowerCase();
      const userDeptId = req.user?.departmentId;

      const dep = await prisma.department.findUnique({
        where: { D_ID },
      });

      if (!dep || dep.IsDeleted) {
        return { status: 404, message: "Phòng ban không tồn tại" };
      }

      const elevatedRoles = ["admin", "system", "pmo", "manager", "sep"];

      if (elevatedRoles.includes(roleName)) {
        return { status: 200, data: dep };
      }

      if (roleName === "user") {
        if (userDeptId && userDeptId === D_ID) {
          return { status: 200, data: dep };
        }
        return {
          status: 403,
          message: "Không có quyền xem phòng ban này",
        };
      }

      return { status: 403, message: "Không có quyền" };
    } catch (err) {
      console.error("GET DEPARTMENT BY ID ERROR:", err);
      return { status: 500, message: "Lỗi server khi lấy phòng ban" };
    }
  },

  // ✅ phòng ban của chính user
  getMyDepartment: async (req) => {
    try {
      const userDeptId = req.user?.departmentId;

      if (!userDeptId) {
        return {
          status: 404,
          message: "Tài khoản chưa được gán phòng ban",
        };
      }

      const dep = await prisma.department.findUnique({
        where: { D_ID: userDeptId },
      });

      if (!dep || dep.IsDeleted) {
        return { status: 404, message: "Phòng ban không tồn tại" };
      }

      return { status: 200, data: dep };
    } catch (err) {
      console.error("GET MY DEPARTMENT ERROR:", err);
      return { status: 500, message: "Lỗi server khi lấy phòng ban" };
    }
  },
};

export default departmentServices;
