
import prisma from './src/config/database.js';

async function checkRoles() {
    try {
        const roles = await prisma.role.findMany({
            select: { R_ID: true, R_Name: true }
        });
        roles.forEach(r => console.log(`${r.R_ID}: ${r.R_Name}`));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkRoles();
