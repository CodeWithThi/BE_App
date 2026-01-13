import 'dotenv/config';
import prisma from './src/config/database.js';

async function listRoles() {
    console.log("--- ROLES ---");
    const roles = await prisma.role.findMany();
    roles.forEach(r => console.log(`${r.R_ID}: ${r.R_Name}`));
}

listRoles().catch(e => console.error(e)).finally(() => prisma.$disconnect());
