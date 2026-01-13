import 'dotenv/config';
import prisma from './src/config/database.js';

async function listAll() {
    console.log("--- ALL ACCOUNTS RAW ---");
    const all = await prisma.account.findMany({
        select: {
            A_ID: true,
            UserName: true,
            R_ID: true,
            Status: true,
            IsDeleted: true
        }
    });
    console.table(all);
    console.log("Total:", all.length);
}

listAll().catch(e => console.error(e)).finally(() => prisma.$disconnect());
