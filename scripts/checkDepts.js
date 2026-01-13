
import prisma from './src/config/database.js';

async function checkDepts() {
    try {
        const depts = await prisma.department.findMany();
        console.log('Departments:', depts);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkDepts();
