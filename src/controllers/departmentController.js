// src/controllers/department.controller.js
import departmentServices from "../services/departmentService.js";

const departmentController = {
  create: async (req, res) => {
    const r = await departmentServices.createDepartment(req);
    return res.status(r.status).json(r);
  },
  update: async (req, res) => {
    const r = await departmentServices.updateDepartment(req);
    return res.status(r.status).json(r);
  },
  softDelete: async (req, res) => {
    const r = await departmentServices.softDeleteDepartment(req);
    return res.status(r.status).json(r);
  },
  list: async (req, res) => {
    const r = await departmentServices.listDepartments(req); // << dòng 18
    return res.status(r.status).json(r);
  },
  detail: async (req, res) => {
    const r = await departmentServices.getDepartmentById(req);
    return res.status(r.status).json(r);
  },
  myDepartment: async (req, res) => {
    const r = await departmentServices.getMyDepartment(req);
    return res.status(r.status).json(r);
  },
};

export default departmentController;
