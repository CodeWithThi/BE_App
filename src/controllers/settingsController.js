
import settingsService from "../services/settingsService.js";

const settingsController = {
    getSettings: async (req, res) => {
        try {
            const settings = await settingsService.getSettings();
            res.status(200).json({ status: 200, data: settings });
        } catch (error) {
            res.status(500).json({ status: 500, message: error.message });
        }
    },

    updateSettings: async (req, res) => {
        try {
            const updated = await settingsService.updateSettings(req.body);
            res.status(200).json({ status: 200, data: updated, message: "Cập nhật thành công" });
        } catch (error) {
            res.status(500).json({ status: 500, message: error.message });
        }
    }
};

export default settingsController;
