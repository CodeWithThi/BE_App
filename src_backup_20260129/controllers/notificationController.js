// src/controllers/notificationController.js
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
} from "../services/notificationService.js";

const notificationController = {
    // GET /notifications?unreadOnly=true&page=1&limit=20
    list: async (req) => {
        const userId = req.user?.aid;
        const { page, limit, unreadOnly } = req.query;
        if (!userId) return { status: 401, message: "Unauthorized" };
        return await getNotifications(userId, page, limit, unreadOnly === "true");
    },

    // PUT /notifications/:id/read
    read: async (req) => {
        const userId = req.user?.aid;
        const { id } = req.params;
        if (!userId) return { status: 401, message: "Unauthorized" };
        return await markAsRead(id, userId);
    },

    // PUT /notifications/read-all
    readAll: async (req) => {
        const userId = req.user?.aid;
        if (!userId) return { status: 401, message: "Unauthorized" };
        return await markAllAsRead(userId);
    },

    // DELETE /notifications/:id
    delete: async (req) => {
        const userId = req.user?.aid;
        const { id } = req.params;
        if (!userId) return { status: 401, message: "Unauthorized" };
        return await deleteNotification(id, userId);
    },
};

export default notificationController;
