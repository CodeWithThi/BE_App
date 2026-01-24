import prisma from '../src/config/database.js';

async function main() {
    try {
        console.log('Seeding broadcast test notification...');

        // Get ALL users
        const users = await prisma.account.findMany();

        if (users.length === 0) {
            console.error("No users found.");
            return;
        }

        console.log(`Found ${users.length} users. Creating notifications for all...`);

        const notifications = users.map(user => ({
            N_ID: "N_" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100000),
            Type: 'system_broadcast',
            Message: `🔊 Thông báo toàn hệ thống: Chào ${user.UserName || 'bạn'}, hệ thống thông báo đã hoạt động!`,
            RecipientId: user.A_ID,
            CreatedAt: new Date(),
            IsRead: false
        }));

        await prisma.notification.createMany({
            data: notifications
        });

        console.log(`Successfully created ${notifications.length} notifications.`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
