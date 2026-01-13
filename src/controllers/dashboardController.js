import dashboardServices from "../services/dashboardService.js";

const dashboardController = {
    getStats: async (req, res) => {
        const r = await dashboardServices.getStats(req);
        return res.status(r.status).json(r);
    }
};

export default dashboardController;
