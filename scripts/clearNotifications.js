// scripts/clearNotifications.js
// Script để xóa tất cả notification cũ trong database
import prisma from '../src/config/database.js';

async function clearNotifications() {
    try {
        console.log('🗑️  Đang xóa tất cả notifications...');

        const count = await prisma.notification.count();
        console.log(`📊 Số notification hiện tại: ${count}`);

        const result = await prisma.notification.deleteMany({});

        console.log(`✅ Đã xóa ${result.count} notifications`);
        console.log('🎉 Database notification đã được làm sạch!');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

clearNotifications();
