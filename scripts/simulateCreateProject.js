
import projectServices from './src/services/projectService.js';
import prisma from './src/config/database.js';

async function simulate() {
    try {
        // 1. Get PMO Account
        const account = await prisma.account.findFirst({
            where: { Role: { R_Name: 'PMO' } },
            include: { Role: true, Member: true }
        });
        if (!account) throw new Error("No PMO account found");

        // 2. Get Valid Department
        const dept = await prisma.department.findFirst({
            where: { IsDeleted: false }
        });
        if (!dept) throw new Error("No Department found");

        console.log(`Simulating with User: ${account.UserName} (${account.Role.R_Name}), Dept: ${dept.D_Name}`);

        // 3. Mock Req
        const req = {
            user: {
                aid: account.A_ID,
                roleId: account.R_ID,
                roleName: account.Role.R_Name,
                departmentId: account.Member?.D_ID
            },
            body: {
                name: "Test Project Simulation " + Date.now(),
                departmentId: dept.D_ID,
                beginDate: new Date(),
                endDate: new Date()
            }
        };

        // 4. Call Service
        const result = await projectServices.createProject(req);
        console.log("Result:", result);

    } catch (e) {
        console.error("Simulation Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

simulate();
