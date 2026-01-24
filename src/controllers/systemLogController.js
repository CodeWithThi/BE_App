import systemLogService from "../services/systemLogService.js";

const systemLogController = {
    getLogs: async (req, res) => {
        const result = await systemLogService.getLogs(req);
        res.status(result.status).json(result);
    }
};

export default systemLogController;
