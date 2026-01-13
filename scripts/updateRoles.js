
import prisma from './src/config/database.js';

async function updateRoles() {
    try {
        // 1. Rename 'sep' -> 'Director'
        await prisma.role.updateMany({
            where: { R_Name: 'sep' },
            data: { R_Name: 'Director', Description: 'Giám đốc trung tâm' }
        });

        // 2. Rename 'manager' -> 'Leader'
        await prisma.role.updateMany({
            where: { R_Name: 'manager' },
            data: { R_Name: 'Leader', Description: 'Trưởng nhóm' }
        });

        // 3. Rename 'user' -> 'Staff'
        await prisma.role.updateMany({
            where: { R_Name: 'user' },
            data: { R_Name: 'Staff', Description: 'Nhân viên' }
        });

        // 4. Ensure PMO is PMO (it is R_003 PMO)
        // 5. Ensure Admin is Admin (R_001)

        // Log final roles
        const roles = await prisma.role.findMany({ select: { R_ID: true, R_Name: true } });
        roles.forEach(r => console.log(`${r.R_ID}: ${r.R_Name}`));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

updateRoles();
