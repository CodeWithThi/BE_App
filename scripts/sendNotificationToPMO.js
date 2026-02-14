// scripts/sendNotificationToPMO.js
// Gửi notification trực tiếp cho PMO bằng cách tìm account có role PMO
import prisma from '../src/config/database.js';
import { createNotification, NOTIFICATION_TYPES, MESSAGE_TEMPLATES } from '../src/services/notificationService.js';

async function send() {
    try {
        console.log('🔍 Tìm account PMO...');

        // Find PMO role
        const pmoRole = await prisma.role.findFirst({
            where: { R_Name: 'PMO' }
        });

        if (!pmoRole) {
            console.log('❌ Không tìm thấy role PMO');
            return;
        }
        console.log('✅ Found Role:', pmoRole.R_ID, pmoRole.R_Name);

        // Find ALL accounts with this role (including inactive for debugging)
        const accounts = await prisma.account.findMany({
            where: { R_ID: pmoRole.R_ID }
        });

        console.log(`📋 Tìm thấy ${accounts.length} accounts với role PMO:`);
        accounts.forEach(a => {
            console.log(`   - ${a.A_ID}: ${a.UserName} | Status: ${a.Status} | Deleted: ${a.IsDeleted}`);
        });

        // Send notif to all PMO accounts (even if status issue)
        for (const acc of accounts) {
            await createNotification(
                NOTIFICATION_TYPES.PROJECT_DIRECTOR_APPROVED,
                acc.A_ID,
                null,
                MESSAGE_TEMPLATES.PROJECT_DIRECTOR_APPROVED('Dự án Website ABC'),
                null,
                null
            );
            console.log(`✅ Sent notification to ${acc.UserName} (${acc.A_ID})`);

            await createNotification(
                NOTIFICATION_TYPES.ESCALATE_TO_PMO,
                acc.A_ID,
                null,
                MESSAGE_TEMPLATES.ESCALATE_TO_PMO('Leader Nhật', 'Cần thêm resource cho sprint 3'),
                null,
                null
            );
            console.log(`✅ Sent escalation notification to ${acc.UserName}`);
        }

        console.log('\n🎉 Hoàn thành! Refresh trang để xem notification.');

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

send();
