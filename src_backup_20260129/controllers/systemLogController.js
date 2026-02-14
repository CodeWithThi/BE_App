import systemLogService from "../services/systemLogService.js";

const systemLogController = {
    getLogs: async (req, res) => {
        try {
            const result = await systemLogService.getLogs(req);
            res.status(result.status).json(result);
        } catch (error) {
            console.error("SystemLog Controller Error:", error);
            res.status(500).json({
                status: 500,
                message: "Server error: " + error.message,
                data: { logs: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
            });
        }
    }
};

export default systemLogController;

