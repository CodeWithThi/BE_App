// src/controllers/account.controller.js
import accountServices from "../services/accountService.js";

const accountController = {
  createAccount: async (req, res) => {
    const r = await accountServices.createAccount(req);
    return res.status(r.status).json(r);
  },

  listAccounts: async (req, res) => {
    const r = await accountServices.listAccounts(req);
    return res.status(r.status).json(r);
  },

  updateAccount: async (req, res) => {
    const r = await accountServices.updateAccount(req);
    return res.status(r.status).json(r);
  },

  changeStatus: async (req, res) => {
    const r = await accountServices.changeStatus(req);
    return res.status(r.status).json(r);
  },

  softDelete: async (req, res) => {
    const r = await accountServices.softDelete(req);
    return res.status(r.status).json(r);
  },

  restoreAccount: async (req, res) => {
    const r = await accountServices.restoreAccount(req);
    return res.status(r.status).json(r);
  },
};

export default accountController;
