// src/services/notificationService.js
import prisma from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a notification record.
 * @param {string} type - Notification type (e.g., task_assigned, task_approved, deadline_changed, comment, file_attached)
 * @param {string} recipientId - Account A_ID of the receiver
 * @param {string|null} senderId - Account A_ID of the sender (null for system notifications)
 * @param {string} message - Human readable message
 * @param {string|null} taskId - Related task ID (optional)
 * @param {string|null} projectId - Related project ID (optional)
 */
export const createNotification = async (type, recipientId, senderId, message, taskId = null, projectId = null) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        N_ID: "N_" + Date.now().toString().slice(-4) + Math.floor(Math.random() * 1000),
        Type: type,
        Message: message,
        RecipientId: recipientId,
        SenderId: senderId,
        TaskId: taskId,
        ProjectId: projectId,
      },
    });
    return { status: 201, data: notification };
  } catch (err) {
    console.error("CREATE NOTIFICATION ERROR:", err);
    return { status: 500, message: "Failed to create notification" };
  }
};

/** Get notifications for a user with pagination */
export const getNotifications = async (userId, page = 1, limit = 20, unreadOnly = false) => {
  const skip = (Number(page) - 1) * Number(limit);
  const where = { RecipientId: userId };
  if (unreadOnly) where.IsRead = false;
  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { CreatedAt: "desc" },
    }),
  ]);
  return {
    status: 200,
    data: notifications,
    pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
  };
};

/** Mark a single notification as read */
export const markAsRead = async (notificationId, userId) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { N_ID: notificationId } });
    if (!notif || notif.RecipientId !== userId) {
      return { status: 404, message: "Notification not found" };
    }
    await prisma.notification.update({
      where: { N_ID: notificationId },
      data: { IsRead: true },
    });
    return { status: 200, message: "Marked as read" };
  } catch (err) {
    console.error("MARK AS READ ERROR:", err);
    return { status: 500, message: "Failed to mark as read" };
  }
};

/** Mark all notifications for a user as read */
export const markAllAsRead = async (userId) => {
  try {
    await prisma.notification.updateMany({
      where: { RecipientId: userId, IsRead: false },
      data: { IsRead: true },
    });
    return { status: 200, message: "All notifications marked as read" };
  } catch (err) {
    console.error("MARK ALL AS READ ERROR:", err);
    return { status: 500, message: "Failed to mark all as read" };
  }
};

/** Delete a notification */
export const deleteNotification = async (notificationId, userId) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { N_ID: notificationId } });
    if (!notif || notif.RecipientId !== userId) {
      return { status: 404, message: "Notification not found" };
    }
    await prisma.notification.delete({ where: { N_ID: notificationId } });
    return { status: 200, message: "Deleted" };
  } catch (err) {
    console.error("DELETE NOTIFICATION ERROR:", err);
    return { status: 500, message: "Failed to delete" };
  }
};
