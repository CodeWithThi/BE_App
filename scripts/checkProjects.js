
import prisma from './src/config/database.js';

async function check() {
    try {
        const count = await prisma.project.count();
        console.log(`Total projects: ${count}`);
        const active = await prisma.project.count({ where: { IsDeleted: false } });
        console.log(`Active projects: ${active}`);
        const all = await prisma.project.findMany({ take: 5 });
        console.log('Sample projects:', all);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
