
import prisma from './src/config/database.js';

async function cleanDepts() {
    try {
        const invalidNames = [
            'SystemAdmin', 'sep', 'PMO', 'pmo_mai', 'pmo_khanh',
            'dt_nhat_mgr', 'dt_han_mgr', 'gv_han_1', 'gv_nhat_1',
            'nguyenvana', 'pmo_test', 'admin'
        ];

        // Also delete any department that matches a username pattern if needed, 
        // but for now delete specific ones that shouldn't be valid departments.
        // Valid departments: Tuyển sinh, Hành chính, Ban giám đốc, Phòng đào tạo, Tiếng Anh, Tiếng Trung, Tiếng Hàn, Tiếng Nhật, Marketing, IT.

        const result = await prisma.department.updateMany({
            where: {
                D_Name: {
                    in: invalidNames
                }
            },
            data: {
                IsDeleted: true
            }
        });

        console.log(`Soft deleted ${result.count} invalid departments.`);

        const remaining = await prisma.department.findMany();
        console.log('Remaining Departments:', remaining.map(d => d.D_Name));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanDepts();
