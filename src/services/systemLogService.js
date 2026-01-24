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
            console.error("Failed to create system log:", error);
        }
    },

    getLogs: async (req) => {
        try {
            const { page = 1, limit = 20, type, actorId, startDate, endDate } = req.query;
            const skip = (page - 1) * limit;

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
            const isAdmin = requester.roleName === 'admin' || requester.roleName === 'system admin' || requester.roleName === 'director'; // Assuming Director can see all too?

            if (!isAdmin) {
                // Force filter by their own ID
                where.ActorId = requester.aid;
            }

            const [logs, total] = await prisma.$transaction([
                prisma.systemLog.findMany({
                    where,
                    include: {
                        Actor: {
                            select: {
                                UserName: true,
                                A_ID: true,
                                Member: { select: { FullName: true, Avatar: true } }
                            }
                        }
                    },
                    orderBy: { CreatedAt: 'desc' },
                    skip: Number(skip),
                    take: Number(limit)
                }),
                prisma.systemLog.count({ where })
            ]);

            return {
                status: 200,
                data: {
                    logs,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                }
            };

        } catch (error) {
            console.error("Get Logs Error:", error);
            return { status: 500, message: "Server error fetching logs" };
        }
    }
};

export default systemLogService;
