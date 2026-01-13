// src/controllers/auth.controller.js
import authServices from "../services/authService.js";

const authController = {
  login: async (req, res) => {
    const r = await authServices.login(req);
    // 👇 phải trả cả object r, KHÔNG được .json(r.status) hay .sendStatus(...)
    res.status(r.status).json(r);
  },

  me: async (req, res) => {
    const r = await authServices.me(req);
    res.status(r.status).json(r);
  },

  changePassword: async (req, res) => {
    const r = await authServices.changePassword(req);
    res.status(r.status).json(r);
  },
};

export default authController;
