
import prisma from './src/config/database.js';

async function testQuery() {
    try {
        const projects = await prisma.project.findMany({
            where: { IsDeleted: false },
            include: { Department: true, Account: { select: { UserName: true } } }
        });
        console.log('Query Success. Projects:', projects.length);
    } catch (e) {
        console.error('Query Failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

testQuery();
