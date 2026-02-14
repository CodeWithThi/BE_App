// src/services/notificationService.js
import prisma from "../config/database.js";

/**
 * Business Notification Types - chỉ dành cho các sự kiện nghiệp vụ
 * KHÔNG bao gồm login/logout - những thứ đó thuộc System Log
 * 
 * Flow: Director ↔ PMO ↔ Leader ↔ Staff
 * Admin: System alerts only
 */
export const NOTIFICATION_TYPES = {
  // ========================================
  // TASK WORKFLOW
  // ========================================
  TASK_ASSIGNED: 'task_assigned',           // PMO/Leader → Staff: task được giao
  TASK_APPROVED: 'task_approved',           // Leader → Staff: task được duyệt
  TASK_REJECTED: 'task_rejected',           // Leader → Staff: task bị từ chối
  TASK_RETURNED: 'task_returned',           // Leader → Staff: task bị trả lại
  TASK_SUBMITTED: 'task_submitted',         // Staff → Leader: task gửi duyệt (legacy)
  TASK_COMPLETED: 'task_completed',         // Staff → Leader: hoàn thành task
  TASK_LATE: 'task_late',                   // System → Leader, PMO: task trễ tiến độ
  STATUS_CHANGED: 'status_changed',         // System → assigned members
  DEADLINE_CHANGED: 'deadline_changed',     // PMO/Leader → Staff: deadline thay đổi

  // ========================================
  // REVIEW WORKFLOW (Staff ↔ Leader)
  // ========================================
  REVIEW_REQUESTED: 'review_requested',     // Staff → Leader: "Task [X] chờ duyệt"
  REVIEW_COMPLETED: 'review_completed',     // Leader → Staff: "Task [X] đã được duyệt"
  FEEDBACK_GIVEN: 'feedback_given',         // Leader → Staff: "Leader feedback task [X]"

  // ========================================
  // ESCALATION WORKFLOW
  // ========================================
  ESCALATE_TO_LEADER: 'escalate_to_leader', // Staff → Leader: cần hỗ trợ
  ESCALATE_TO_PMO: 'escalate_to_pmo',       // Leader → PMO: vượt khả năng xử lý
  ESCALATE_RESOLVED: 'escalate_resolved',   // Response to escalation

  // ========================================
  // PROJECT WORKFLOW (Director ↔ PMO ↔ Leader)
  // ========================================
  PROJECT_NEEDS_APPROVAL: 'project_needs_approval',   // PMO → Director: cần phê duyệt
  PROJECT_DIRECTOR_APPROVED: 'project_director_approved', // Director → PMO, Leader
  PROJECT_DIRECTOR_REJECTED: 'project_director_rejected', // Director → PMO
  PROJECT_ASSIGNED: 'project_assigned',     // PMO → Leader: "Có dự án mới cho phòng ban"
  PROJECT_ACCEPTED: 'project_accepted',     // Leader → PMO: "Leader đã nhận dự án"
  PROJECT_CLOSED: 'project_closed',         // PMO → Director, Leader

  // Legacy (backward compat)
  PROJECT_CREATED: 'project_created',       // PMO → Director: dự án mới
  PROJECT_APPROVED: 'project_approved',     // Director → PMO: dự án được duyệt

  // ========================================
  // WORKLOAD / KPI ALERTS
  // ========================================
  WORKLOAD_OVERLOAD: 'workload_overload',   // System → PMO: workload vượt ngưỡng
  WORKLOAD_CHANGED: 'workload_changed',     // PMO → Leader, Staff: phân công thay đổi
  KPI_ALERT: 'kpi_alert',                   // System → Director: KPI không đạt
  BUDGET_EXCEEDED: 'budget_exceeded',       // System → Director: vượt ngân sách
  PROGRESS_REPORT: 'progress_report',       // PMO → Director: báo cáo tiến độ

  // ========================================
  // INTERACTION
  // ========================================
  COMMENT_NEW: 'comment_new',               // Any → Task assignee
  FILE_ATTACHED: 'file_attached',           // Any → Task assignee
  MENTION: 'mention',                       // Any → Mentioned user

  // ========================================
  // SYSTEM ALERTS (Admin only)
  // ========================================
  SYSTEM_ALERT: 'system_alert',             // System → Admin: cảnh báo hệ thống
  SYSTEM_ERROR: 'system_error',             // System → Admin: lỗi hệ thống
  USER_ADDED: 'user_added',                 // System → Admin: user mới
  LOGIN_FAILED_ALERT: 'login_failed_alert', // System → Admin: đăng nhập thất bại nhiều lần
};

/**
 * Mapping: Notification Type → Allowed Recipient Roles
 * Đảm bảo mỗi role chỉ nhận notification phù hợp với phạm vi trách nhiệm
 */
export const NOTIFICATION_ROLE_MAP = {
  // Task workflow
  [NOTIFICATION_TYPES.TASK_ASSIGNED]: ['staff'],
  [NOTIFICATION_TYPES.TASK_APPROVED]: ['staff'],
  [NOTIFICATION_TYPES.TASK_REJECTED]: ['staff'],
  [NOTIFICATION_TYPES.TASK_RETURNED]: ['staff'],
  [NOTIFICATION_TYPES.TASK_SUBMITTED]: ['leader'],
  [NOTIFICATION_TYPES.TASK_COMPLETED]: ['leader'],
  [NOTIFICATION_TYPES.TASK_LATE]: ['leader', 'pmo'],
  [NOTIFICATION_TYPES.STATUS_CHANGED]: ['staff', 'leader'],
  [NOTIFICATION_TYPES.DEADLINE_CHANGED]: ['staff'],

  // Review workflow
  [NOTIFICATION_TYPES.REVIEW_REQUESTED]: ['leader'],
  [NOTIFICATION_TYPES.REVIEW_COMPLETED]: ['staff'],
  [NOTIFICATION_TYPES.FEEDBACK_GIVEN]: ['staff'],

  // Escalation
  [NOTIFICATION_TYPES.ESCALATE_TO_LEADER]: ['leader'],
  [NOTIFICATION_TYPES.ESCALATE_TO_PMO]: ['pmo'],
  [NOTIFICATION_TYPES.ESCALATE_RESOLVED]: ['staff', 'leader'],

  // Project workflow
  [NOTIFICATION_TYPES.PROJECT_NEEDS_APPROVAL]: ['director'],
  [NOTIFICATION_TYPES.PROJECT_DIRECTOR_APPROVED]: ['pmo', 'leader'],
  [NOTIFICATION_TYPES.PROJECT_DIRECTOR_REJECTED]: ['pmo'],
  [NOTIFICATION_TYPES.PROJECT_ASSIGNED]: ['leader'],
  [NOTIFICATION_TYPES.PROJECT_ACCEPTED]: ['pmo'],
  [NOTIFICATION_TYPES.PROJECT_CLOSED]: ['director', 'leader'],
  [NOTIFICATION_TYPES.PROJECT_CREATED]: ['director'],
  [NOTIFICATION_TYPES.PROJECT_APPROVED]: ['pmo'],

  // Alerts
  [NOTIFICATION_TYPES.WORKLOAD_OVERLOAD]: ['pmo'],
  [NOTIFICATION_TYPES.WORKLOAD_CHANGED]: ['staff', 'leader'],
  [NOTIFICATION_TYPES.KPI_ALERT]: ['director'],
  [NOTIFICATION_TYPES.BUDGET_EXCEEDED]: ['director'],
  [NOTIFICATION_TYPES.PROGRESS_REPORT]: ['director'],

  // Interaction
  [NOTIFICATION_TYPES.COMMENT_NEW]: ['staff', 'leader'],
  [NOTIFICATION_TYPES.FILE_ATTACHED]: ['staff', 'leader'],
  [NOTIFICATION_TYPES.MENTION]: ['staff', 'leader', 'pmo', 'director'],

  // System (Admin only)
  [NOTIFICATION_TYPES.SYSTEM_ALERT]: ['admin'],
  [NOTIFICATION_TYPES.SYSTEM_ERROR]: ['admin'],
  [NOTIFICATION_TYPES.USER_ADDED]: ['admin'],
  [NOTIFICATION_TYPES.LOGIN_FAILED_ALERT]: ['admin'],
};

/**
 * Create a business notification record.
 * @param {string} type - Notification type from NOTIFICATION_TYPES
 * @param {string} recipientId - Account A_ID of the receiver
 * @param {string|null} senderId - Account A_ID of the sender (null for system notifications)
 * @param {string} message - Human readable message
 * @param {string|null} taskId - Related task ID (optional)
 * @param {string|null} projectId - Related project ID (optional)
 */
export const createNotification = async (type, recipientId, senderId, message, taskId = null, projectId = null) => {
  try {
    // Validate type is a business notification type
    const validTypes = Object.values(NOTIFICATION_TYPES);
    if (!validTypes.includes(type)) {
      console.warn(`Invalid notification type: ${type}. Skipping notification.`);
      return { status: 400, message: "Invalid notification type" };
    }

    const notification = await prisma.notification.create({
      data: {
        N_ID: "N_" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000),
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
    console.error("CREATE NOTIFICATION ERROR:", err.message);
    return { status: 500, message: "Failed to create notification" };
  }
};

/**
 * Create notifications for multiple recipients
 * @param {string} type - Notification type
 * @param {string[]} recipientIds - Array of Account A_IDs
 * @param {string|null} senderId - Sender A_ID
 * @param {string} message - Message
 * @param {string|null} taskId - Task ID
 * @param {string|null} projectId - Project ID
 */
export const createNotificationForMultiple = async (type, recipientIds, senderId, message, taskId = null, projectId = null) => {
  const results = [];
  for (const recipientId of recipientIds) {
    if (recipientId && recipientId !== senderId) {
      const result = await createNotification(type, recipientId, senderId, message, taskId, projectId);
      results.push(result);
    }
  }
  return results;
};

/**
 * Get accounts by role for sending notifications
 * @param {string} roleName - Role name (admin, director, pmo, leader, staff)
 * @param {string|null} departmentId - Optional department filter
 */
export const getAccountsByRole = async (roleName, departmentId = null) => {
  try {
    // Find role by name (case-insensitive search)
    const roleNameLower = roleName.toLowerCase();

    // Map common names to database names
    const roleNameMap = {
      'admin': ['admin', 'system admin', 'admin hệ thống'],
      'director': ['director', 'giám đốc'],
      'pmo': ['pmo'],
      'leader': ['leader', 'trưởng phòng', 'tp'],
      'staff': ['staff', 'nhân viên'],
    };

    const possibleNames = roleNameMap[roleNameLower] || [roleNameLower];

    // Find the role in database
    const role = await prisma.role.findFirst({
      where: {
        R_Name: {
          in: possibleNames.map(n => n),
          mode: 'insensitive'
        }
      }
    });

    if (!role) {
      console.log(`[getAccountsByRole] No role found for: ${roleName}`);
      return [];
    }

    const where = {
      R_ID: role.R_ID,
      Status: 'active',
      IsDeleted: false,
    };

    // If departmentId provided, filter by department
    if (departmentId) {
      where.Member = {
        D_ID: departmentId
      };
    }

    const accounts = await prisma.account.findMany({
      where,
      select: { A_ID: true }
    });

    console.log(`[getAccountsByRole] Found ${accounts.length} accounts for role ${roleName} (${role.R_ID})`);
    return accounts.map(a => a.A_ID);
  } catch (err) {
    console.error("GET ACCOUNTS BY ROLE ERROR:", err.message);
    return [];
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
      include: {
        Sender: {
          select: {
            UserName: true,
            A_ID: true,
            Member: { select: { FullName: true } }
          }
        }
      }
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
    console.error("MARK AS READ ERROR:", err.message);
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
    console.error("MARK ALL AS READ ERROR:", err.message);
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
    console.error("DELETE NOTIFICATION ERROR:", err.message);
    return { status: 500, message: "Failed to delete" };
  }
};

/** Get unread count for a user */
export const getUnreadCount = async (userId) => {
  try {
    const count = await prisma.notification.count({
      where: { RecipientId: userId, IsRead: false }
    });
    return { status: 200, data: { count } };
  } catch (err) {
    console.error("GET UNREAD COUNT ERROR:", err.message);
    return { status: 500, message: "Failed to get unread count" };
  }
};

// ========================================
// MESSAGE TEMPLATES (Hoàn toàn Tiếng Việt)
// ========================================
export const MESSAGE_TEMPLATES = {
  // Quy trình dự án
  PROJECT_NEEDS_APPROVAL: (projectName) => `Dự án "${projectName}" cần phê duyệt`,
  PROJECT_DIRECTOR_APPROVED: (projectName) => `Dự án "${projectName}" đã được Giám đốc phê duyệt`,
  PROJECT_DIRECTOR_REJECTED: (projectName, reason) => `Dự án "${projectName}" bị từ chối: ${reason || 'Không đạt yêu cầu'}`,
  PROJECT_ASSIGNED: (projectName, deptName) => `Có dự án mới "${projectName}" cho ${deptName}. Trạng thái: Chờ nhận`,
  PROJECT_ACCEPTED: (leaderName, projectName) => `${leaderName} đã nhận dự án "${projectName}"`,

  // Quy trình công việc
  TASK_ASSIGNED: (taskName) => `Bạn được giao công việc mới: "${taskName}"`,
  REVIEW_REQUESTED: (staffName, taskName) => `${staffName} yêu cầu duyệt công việc "${taskName}"`,
  REVIEW_COMPLETED: (taskName) => `Công việc "${taskName}" đã được duyệt`,
  FEEDBACK_GIVEN: (leaderName, taskName) => `${leaderName} đã phản hồi công việc "${taskName}"`,
  TASK_REJECTED: (taskName, reason) => `Công việc "${taskName}" bị từ chối: ${reason || 'Cần sửa lại'}`,
  TASK_RETURNED: (taskName) => `Công việc "${taskName}" được trả lại để chỉnh sửa`,
  TASK_COMPLETED: (staffName, taskName) => `${staffName} đã hoàn thành công việc "${taskName}"`,

  // Leo thang
  ESCALATE_TO_LEADER: (staffName, taskName) => `${staffName} cần hỗ trợ với công việc "${taskName}"`,
  ESCALATE_TO_PMO: (leaderName, message) => `${leaderName} báo cáo sự cố: ${message}`,
  ESCALATE_RESOLVED: (resolverName, issue) => `${resolverName} đã giải quyết: ${issue}`,

  // Cảnh báo
  WORKLOAD_OVERLOAD: (deptName, percent) => `Phòng ${deptName} có khối lượng công việc vượt ngưỡng ${percent}%`,
  KPI_ALERT: (projectName) => `Chỉ số hiệu suất dự án "${projectName}" không đạt mục tiêu`,
  BUDGET_EXCEEDED: (projectName, percent) => `Dự án "${projectName}" vượt ngân sách ${percent}%`,

  // Hệ thống
  SYSTEM_ALERT: (message) => `⚠️ Cảnh báo hệ thống: ${message}`,
  SYSTEM_ERROR: (error) => `❌ Lỗi hệ thống: ${error}`,
};

// ========================================
// CONVENIENCE NOTIFICATION FUNCTIONS
// ========================================

/**
 * Send notification to all users of a specific role
 * @param {string} type - Notification type
 * @param {string} roleName - Target role
 * @param {string} senderId - Sender account ID
 * @param {string} message - Message
 * @param {object} options - { taskId, projectId, departmentId }
 */
export const notifyRole = async (type, roleName, senderId, message, options = {}) => {
  const { taskId = null, projectId = null, departmentId = null } = options;

  const recipientIds = await getAccountsByRole(roleName, departmentId);
  console.log(`[notifyRole] Sending ${type} to ${recipientIds.length} ${roleName}(s)`);

  if (recipientIds.length === 0) {
    console.warn(`[notifyRole] No recipients found for role: ${roleName}`);
    return [];
  }

  return createNotificationForMultiple(type, recipientIds, senderId, message, taskId, projectId);
};

/**
 * Notify Director about project needing approval
 */
export const notifyDirectorProjectApproval = async (projectName, projectId, senderId) => {
  return notifyRole(
    NOTIFICATION_TYPES.PROJECT_NEEDS_APPROVAL,
    'director',
    senderId,
    MESSAGE_TEMPLATES.PROJECT_NEEDS_APPROVAL(projectName),
    { projectId }
  );
};

/**
 * Notify PMO and Leaders when Director approves project
 */
export const notifyProjectApproved = async (projectName, projectId, departmentId, senderId) => {
  const message = MESSAGE_TEMPLATES.PROJECT_DIRECTOR_APPROVED(projectName);

  // Notify PMO
  await notifyRole(NOTIFICATION_TYPES.PROJECT_DIRECTOR_APPROVED, 'pmo', senderId, message, { projectId });

  // Notify department Leader
  await notifyRole(NOTIFICATION_TYPES.PROJECT_DIRECTOR_APPROVED, 'leader', senderId, message, { projectId, departmentId });
};

/**
 * Notify Leader about new project assignment
 */
export const notifyLeaderProjectAssigned = async (projectName, projectId, departmentName, departmentId, senderId) => {
  return notifyRole(
    NOTIFICATION_TYPES.PROJECT_ASSIGNED,
    'leader',
    senderId,
    MESSAGE_TEMPLATES.PROJECT_ASSIGNED(projectName, departmentName),
    { projectId, departmentId }
  );
};

/**
 * Notify Leader about staff review request
 */
export const notifyLeaderReviewRequest = async (staffName, taskName, taskId, leaderId, senderId) => {
  return createNotification(
    NOTIFICATION_TYPES.REVIEW_REQUESTED,
    leaderId,
    senderId,
    MESSAGE_TEMPLATES.REVIEW_REQUESTED(staffName, taskName),
    taskId
  );
};

/**
 * Notify Staff about review completed
 */
export const notifyStaffReviewCompleted = async (taskName, taskId, staffId, senderId) => {
  return createNotification(
    NOTIFICATION_TYPES.REVIEW_COMPLETED,
    staffId,
    senderId,
    MESSAGE_TEMPLATES.REVIEW_COMPLETED(taskName),
    taskId
  );
};

/**
 * Escalate to Leader
 */
export const escalateToLeader = async (staffName, taskName, taskId, leaderId, senderId) => {
  return createNotification(
    NOTIFICATION_TYPES.ESCALATE_TO_LEADER,
    leaderId,
    senderId,
    MESSAGE_TEMPLATES.ESCALATE_TO_LEADER(staffName, taskName),
    taskId
  );
};

/**
 * Escalate to PMO
 */
export const escalateToPMO = async (leaderName, message, taskId, senderId) => {
  return notifyRole(
    NOTIFICATION_TYPES.ESCALATE_TO_PMO,
    'pmo',
    senderId,
    MESSAGE_TEMPLATES.ESCALATE_TO_PMO(leaderName, message),
    { taskId }
  );
};
