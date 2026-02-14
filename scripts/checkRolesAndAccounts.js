// scripts/checkRolesAndAccounts.js
import prisma from '../src/config/database.js';

async function check() {
    try {
        // Check roles
        const roles = await prisma.role.findMany();
        console.log('📋 Roles trong database:');
        roles.forEach(r => console.log(`  - ${r.R_ID}: "${r.R_Name}"`));

        // Check accounts with PMO-like role
        const accounts = await prisma.account.findMany({
            where: { Status: 'active', IsDeleted: false },
            include: { Role: true }
        });

        console.log('\n👥 Accounts active:');
        accounts.forEach(a => {
            console.log(`  - ${a.A_ID}: ${a.UserName} (Role: ${a.Role?.R_Name})`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
