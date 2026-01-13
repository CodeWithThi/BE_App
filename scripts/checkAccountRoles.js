
import prisma from './src/config/database.js';

async function checkAccountRoles() {
    try {
        const accounts = await prisma.account.findMany({
            where: { R_ID: 'R_003' },
            include: { Role: true }
        });

        console.log('--- PMO ACCOUNTS ---');
        accounts.forEach(acc => {
            console.log(`User: ${acc.UserName}, ID: ${acc.A_ID}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkAccountRoles();
