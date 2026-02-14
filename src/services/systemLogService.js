// src/services/systemLogService.js
import prisma from "../config/database.js";

/**
 * System Log Actions - ghi lại các hành động kỹ thuật/hệ thống
 * KHÔNG bao gồm các sự kiện nghiệp vụ - những thứ đó thuộc Notification
 */
export const LOG_ACTIONS = {
    // Authentication
    LOGIN: 'login',
    LOGOUT: 'logout',
    LOGIN_FAILED: 'login_failed',
    PASSWORD_RESET: 'password_reset',
    PASSWORD_CHANGE: 'password_change',

    // User Management
    USER_CREATE: 'user_create',
    USER_UPDATE: 'user_update',
    USER_DELETE: 'user_delete',
    USER_RESTORE: 'user_restore',

    // Project Management
    PROJECT_CREATE: 'create_project',
    PROJECT_UPDATE: 'update_project',
    PROJECT_DELETE: 'delete_project',

    // Task Management - NEW
    TASK_CREATE: 'task_create',
    TASK_UPDATE: 'task_update',
    TASK_DELETE: 'task_delete',
    TASK_STATUS_CHANGE: 'task_status_change',
    TASK_ASSIGN: 'task_assign',
    TASK_COMPLETE: 'task_complete',

    // Configuration
    CONFIG_CHANGE: 'config_change',
    ROLE_CHANGE: 'role_change',
    PERMISSION_CHANGE: 'permission_change',

    // Department
    DEPARTMENT_CREATE: 'department_create',
    DEPARTMENT_UPDATE: 'department_update',
    DEPARTMENT_DELETE: 'department_delete',
};

/**
 * Create a system log entry
 * @param {string} action - Action type from LOG_ACTIONS
 * @param {string} actorId - Account A_ID of the actor
 * @param {string} message - Human readable message
 * @param {string|null} targetType - Type of target (e.g., 'user', 'department', 'config')
 * @param {string|null} targetId - ID of the target entity
 */
export const createLog = async (action, actorId, message, targetType = null, targetId = null) => {
    try {
        // Validate action
        const validActions = Object.values(LOG_ACTIONS);
        if (!validActions.includes(action)) {
            console.warn(`Invalid log action: ${action}. Using 'unknown'.`);
            action = 'unknown';
        }

        await prisma.systemLog.create({
            data: {
                Action: action,
                ActorId: actorId,
                Message: message,
                TargetType: targetType,
                TargetId: targetId
            }
        });
        console.log(`[SYSTEM LOG] ${action}: ${message}`);
    } catch (error) {
        console.error("Failed to create system log:", error.message);
    }
};

/**
 * Get system logs with pagination
 * @param {object} req - Express request object (contains user info and query params)
 * 
 * Access rules:
 * - Admin System: can view ALL logs
 * - Other roles: can ONLY view their own logs (for security audit)
 */
export const getLogs = async (req) => {
    try {
        const { page = 1, limit = 20, type, actorId, startDate, endDate } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where = {};

        // Filter by action type
        if (type && type !== 'all') {
            where.Action = type;
        }

        // Filter by date range
        if (startDate && endDate) {
            where.CreatedAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        // Filter by TargetId (e.g. for specific Task logs)
        if (req.query.targetId) {
            where.TargetId = req.query.targetId;
        }

        // Role-based access control
        const requester = req.user;
        if (!requester) {
            return { status: 401, message: "Unauthorized - no user info" };
        }

        const roleName = (requester.roleName || '').toLowerCase();
        const isAdminSystem = ['admin', 'system admin'].includes(roleName);

        // Only Admin System can view all logs
        // Other roles can only view their own logs
        if (!isAdminSystem) {
            where.ActorId = requester.aid;
        } else if (actorId) {
            // Admin can filter by specific actor
            where.ActorId = actorId;
        }

        const total = await prisma.systemLog.count({ where });

        const logs = await prisma.systemLog.findMany({
            where,
            include: {
                Actor: {
                    select: {
                        UserName: true,
                        A_ID: true,
                        Avatar: true,
                        Member: { select: { FullName: true } }
                    }
                }
            },
            orderBy: { CreatedAt: 'desc' },
            skip: skip,
            take: Number(limit)
        });

        return {
            status: 200,
            data: {
                logs,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit))
                }
            }
        };

    } catch (error) {
        console.error("Get Logs Error:", error.message);

        // Check if it's a table not found error
        if (error.code === 'P2021' || error.message?.includes('does not exist')) {
            return {
                status: 200,
                data: {
                    logs: [],
                    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
                },
                message: "SystemLog table not initialized yet"
            };
        }

        return { status: 500, message: "Server error fetching logs: " + error.message };
    }
};

/**
 * Get available log action types for filter dropdown
 */
export const getLogActionTypes = () => {
    return {
        status: 200,
        data: Object.entries(LOG_ACTIONS).map(([key, value]) => ({
            key,
            value,
            label: getActionLabel(value)
        }))
    };
};

/**
 * Get human-readable label for action
 */
const getActionLabel = (action) => {
    const labels = {
        'login': 'Đăng nhập',
        'logout': 'Đăng xuất',
        'login_failed': 'Đăng nhập thất bại',
        'password_reset': 'Đặt lại mật khẩu',
        'password_change': 'Đổi mật khẩu',
        'user_create': 'Tạo người dùng',
        'user_update': 'Cập nhật người dùng',
        'user_delete': 'Xóa người dùng',
        'user_restore': 'Khôi phục người dùng',
        'config_change': 'Thay đổi cấu hình',
        'role_change': 'Thay đổi vai trò',
        'permission_change': 'Thay đổi phân quyền',
        'department_create': 'Tạo phòng ban',
        'department_update': 'Cập nhật phòng ban',
        'department_delete': 'Xóa phòng ban',
        // Task-related labels
        'task_create': 'Tạo công việc',
        'task_update': 'Cập nhật công việc',
        'task_delete': 'Xóa công việc',
        'task_status_change': 'Thay đổi trạng thái công việc',
        'task_assign': 'Giao công việc',
        'task_complete': 'Hoàn thành công việc',
    };
    return labels[action] || action;
};

export default {
    LOG_ACTIONS,
    createLog,
    getLogs,
    getLogActionTypes,
};
