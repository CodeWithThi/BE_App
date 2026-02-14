// src/routes/escalationRoutes.js
import express from 'express';
import { escalateToLeader, escalateToPMO, NOTIFICATION_TYPES, MESSAGE_TEMPLATES, createNotification, getAccountsByRole } from '../services/notificationService.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import prisma from '../config/database.js';

const router = express.Router();

/**
 * POST /api/escalate/to-leader
 * Staff escalates task issue to Leader
 * Body: { taskId, message }
 */
router.post('/to-leader', authMiddleware.verifyToken, async (req, res) => {
    try {
        const actor = req.user;
        const role = (actor.roleName || '').toLowerCase();
        const { taskId, message } = req.body;

        // Only Staff can escalate to Leader
        if (role !== 'staff' && role !== 'nhân viên') {
            return res.status(403).json({ message: "Chỉ Staff mới có thể escalate lên Leader" });
        }

        if (!taskId || !message) {
            return res.status(400).json({ message: "taskId và message là bắt buộc" });
        }

        // Get task and project info
        const task = await prisma.task.findUnique({
            where: { T_ID: taskId },
            include: { Project: { include: { Department: true } } }
        });

        if (!task) {
            return res.status(404).json({ message: "Không tìm thấy task" });
        }

        // Get actor's member info for name
        const memberInfo = await prisma.member.findUnique({
            where: { M_ID: actor.mid },
            select: { M_Name: true }
        });
        const staffName = memberInfo?.M_Name || actor.username || 'Staff';

        // Find Leaders of the department
        const departmentId = task.Project?.D_ID;
        if (!departmentId) {
            return res.status(400).json({ message: "Không xác định được phòng ban của task" });
        }

        const leaderIds = await getAccountsByRole('leader', departmentId);

        if (leaderIds.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy Leader của phòng ban" });
        }

        // Send notifications to Leaders
        for (const leaderId of leaderIds) {
            await createNotification(
                NOTIFICATION_TYPES.ESCALATE_TO_LEADER,
                leaderId,
                actor.aid,
                MESSAGE_TEMPLATES.ESCALATE_TO_LEADER(staffName, task.Title) + `: ${message}`,
                taskId,
                task.P_ID
            );
        }

        console.log(`[ESCALATION] Staff ${staffName} escalated task "${task.Title}" to ${leaderIds.length} leaders`);

        return res.status(200).json({
            message: "Đã gửi yêu cầu hỗ trợ đến Leader",
            leadersNotified: leaderIds.length
        });

    } catch (err) {
        console.error("ESCALATE TO LEADER ERROR:", err);
        return res.status(500).json({ message: "Lỗi server khi escalate" });
    }
});

/**
 * POST /api/escalate/to-pmo
 * Leader escalates issue to PMO
 * Body: { taskId, message }
 */
router.post('/to-pmo', authMiddleware.verifyToken, async (req, res) => {
    try {
        const actor = req.user;
        const role = (actor.roleName || '').toLowerCase();
        const { taskId, message } = req.body;

        // Only Leader can escalate to PMO
        const isLeader = role === 'leader' || role === 'trưởng phòng' || role === 'tp';
        if (!isLeader) {
            return res.status(403).json({ message: "Chỉ Leader mới có thể escalate lên PMO" });
        }

        if (!message) {
            return res.status(400).json({ message: "message là bắt buộc" });
        }

        // Get leader's member info for name
        const memberInfo = await prisma.member.findUnique({
            where: { M_ID: actor.mid },
            select: { M_Name: true }
        });
        const leaderName = memberInfo?.M_Name || actor.username || 'Leader';

        // Find PMO users
        const pmoIds = await getAccountsByRole('pmo');

        if (pmoIds.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy PMO trong hệ thống" });
        }

        // Send notifications to PMOs
        for (const pmoId of pmoIds) {
            await createNotification(
                NOTIFICATION_TYPES.ESCALATE_TO_PMO,
                pmoId,
                actor.aid,
                MESSAGE_TEMPLATES.ESCALATE_TO_PMO(leaderName, message),
                taskId || null,
                null
            );
        }

        console.log(`[ESCALATION] Leader ${leaderName} escalated to ${pmoIds.length} PMOs: ${message}`);

        return res.status(200).json({
            message: "Đã báo cáo sự cố lên PMO",
            pmosNotified: pmoIds.length
        });

    } catch (err) {
        console.error("ESCALATE TO PMO ERROR:", err);
        return res.status(500).json({ message: "Lỗi server khi escalate" });
    }
});

export default router;
