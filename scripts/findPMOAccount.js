// scripts/findPMOAccount.js
import prisma from '../src/config/database.js';

async function find() {
    try {
        // Find all accounts with PMO role
        const pmoRole = await prisma.role.findFirst({
            where: { R_Name: { contains: 'PMO', mode: 'insensitive' } }
        });
        console.log('PMO Role:', pmoRole);

        if (pmoRole) {
            const pmoAccounts = await prisma.account.findMany({
                where: { R_ID: pmoRole.R_ID },
                include: { Role: true }
            });
            console.log('\nPMO Accounts (all):');
            pmoAccounts.forEach(a => {
                console.log(`  - ${a.A_ID}: ${a.UserName} | Status: ${a.Status} | Deleted: ${a.IsDeleted}`);
            });
        }

        // Also check for adminPMO specifically
        const adminPMO = await prisma.account.findFirst({
            where: { UserName: { contains: 'adminPMO', mode: 'insensitive' } },
            include: { Role: true }
        });
        console.log('\nadminPMO account:', adminPMO ? {
            A_ID: adminPMO.A_ID,
            UserName: adminPMO.UserName,
            Status: adminPMO.Status,
            IsDeleted: adminPMO.IsDeleted,
            Role: adminPMO.Role?.R_Name
        } : 'NOT FOUND');

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

find();
