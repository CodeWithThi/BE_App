// scripts/testNotificationPMO.js
// Script để tạo notification test cho PMO
import prisma from '../src/config/database.js';
import {
    createNotification,
    getAccountsByRole,
    NOTIFICATION_TYPES,
    MESSAGE_TEMPLATES
} from '../src/services/notificationService.js';

async function sendTestNotifications() {
    try {
        console.log('🔔 Đang tạo notification test cho PMO...\n');

        // Tìm PMO accounts
        const pmoIds = await getAccountsByRole('pmo');
        console.log(`📋 Tìm thấy ${pmoIds.length} tài khoản PMO`);

        if (pmoIds.length === 0) {
            console.log('❌ Không tìm thấy PMO nào trong hệ thống!');
            return;
        }

        // Gửi các loại notification khác nhau cho PMO
        for (const pmoId of pmoIds) {
            // 1. Director approved project
            await createNotification(
                NOTIFICATION_TYPES.PROJECT_DIRECTOR_APPROVED,
                pmoId,
                null, // System notification
                MESSAGE_TEMPLATES.PROJECT_DIRECTOR_APPROVED('Dự án Website ABC'),
                null,
                null
            );
            console.log(`✅ Sent: Dự án được Director phê duyệt → ${pmoId}`);

            // 2. Leader escalate
            await createNotification(
                NOTIFICATION_TYPES.ESCALATE_TO_PMO,
                pmoId,
                null,
                MESSAGE_TEMPLATES.ESCALATE_TO_PMO('Nguyễn Văn A (Leader)', 'Thiếu resource cho sprint 3'),
                null,
                null
            );
            console.log(`✅ Sent: Leader escalate sự cố → ${pmoId}`);

            // 3. Project accepted by Leader
            await createNotification(
                NOTIFICATION_TYPES.PROJECT_ACCEPTED,
                pmoId,
                null,
                MESSAGE_TEMPLATES.PROJECT_ACCEPTED('Trần Thị B', 'Dự án Mobile App'),
                null,
                null
            );
            console.log(`✅ Sent: Leader đã nhận dự án → ${pmoId}`);
        }

        console.log('\n🎉 Hoàn thành! Refresh trang để xem notification mới.');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

sendTestNotifications();
