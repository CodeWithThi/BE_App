import prisma from '../src/config/database.js';

async function main() {
    try {
        console.log('Seeding test notification...');

        // Find a user to likely receive notification (e.g. ad1)
        const user = await prisma.account.findFirst();

        if (!user) {
            console.error("No user found in Account table to assign notification to.");
            return;
        }

        console.log(`Creating notification for user: ${user.UserName} (${user.A_ID})`);

        const notification = await prisma.notification.create({
            data: {
                N_ID: "N_" + Date.now(),
                Type: 'system_test',
                Message: 'Đây là thông báo thử nghiệm từ hệ thống',
                RecipientId: user.A_ID,
                CreatedAt: new Date(),
                IsRead: false
            },
        });

        console.log('Created notification:', notification);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
