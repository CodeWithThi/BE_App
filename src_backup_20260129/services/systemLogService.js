import prisma from "../config/database.js";

const systemLogService = {
    createLog: async (action, actorId, message, targetType = null, targetId = null) => {
        try {
            // Async creation to not block main thread
            // We don't await this in the main flow usually, but for consistency we can.
            await prisma.systemLog.create({
                data: {
                    Action: action,
                    ActorId: actorId,
                    Message: message,
                    TargetType: targetType,
                    TargetId: targetId
                }
            });
        } catch (error) {
            console.error("Failed to create system log:", error.message);
        }
    },

    getLogs: async (req) => {
        try {
            const { page = 1, limit = 20, type, actorId, startDate, endDate } = req.query;
            const skip = (Number(page) - 1) * Number(limit);

            const where = {};
            if (type) where.Action = type;
            if (actorId) where.ActorId = actorId;
            if (startDate && endDate) {
                where.CreatedAt = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }

            // Check role permissions:
            // If user is Admin/Director, they can see all (or filter by actorId).
            // If user is Staff/Leader, they should ideally only see their own logs??
            // Requirement says: "Admin system viewing all", "Others see their own".
            const requester = req.user;
            if (!requester) {
                return { status: 401, message: "Unauthorized - no user info" };
            }

            const roleName = (requester.roleName || '').toLowerCase();
            const isAdmin = ['admin', 'system admin', 'director', 'pmo'].includes(roleName);

            if (!isAdmin) {
                // Force filter by their own ID
                where.ActorId = requester.aid;
            }

            // First check if table exists by doing a simple count
            const total = await prisma.systemLog.count({ where });

            const logs = await prisma.systemLog.findMany({
                where,
                include: {
                    Actor: {
                        select: {
                            UserName: true,
                            A_ID: true,
                            Avatar: true,  // Avatar is on Account, not Member
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
            console.error("Full error:", error);

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
    }
};

export default systemLogService;

