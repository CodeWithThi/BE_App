import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    // CLEANUP (Order is important due to foreign keys)
    await prisma.systemLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.taskComment.deleteMany();
    await prisma.task_Member.deleteMany();
    await prisma.task_Label.deleteMany();
    await prisma.checklistItem.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.task_Report.deleteMany();
    await prisma.task.deleteMany(); // Deletes tasks and subtasks
    await prisma.project.deleteMany();
    await prisma.account.deleteMany();
    await prisma.member.deleteMany();
    await prisma.department.deleteMany();
    await prisma.role_Permission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.role.deleteMany();

    console.log('Deleted old data.');

    // 1. ROLES
    const rolesData = [
        { R_ID: 'R_ADMIN', R_Name: 'System Admin', Description: 'Full system access' },
        { R_ID: 'R_DIRECTOR', R_Name: 'Director', Description: 'Strategic oversight' },
        { R_ID: 'R_PMO', R_Name: 'PMO', Description: 'Project Management Office' },
        { R_ID: 'R_LEADER', R_Name: 'Leader', Description: 'Team Leader' },
        { R_ID: 'R_STAFF', R_Name: 'Staff', Description: 'Team Member' },
    ];

    for (const r of rolesData) {
        await prisma.role.create({ data: r });
    }
    console.log('Roles created.');

    // 2. DEPARTMENTS
    const board = await prisma.department.create({
        data: { D_ID: 'D_BOARD', D_Name: 'Board of Directors', Status: 'Active' }
    });

    const deptIT = await prisma.department.create({
        data: { D_ID: 'D_IT', D_Name: 'Information Technology', Parent_D_ID: board.D_ID, Status: 'Active' }
    });

    const deptHR = await prisma.department.create({
        data: { D_ID: 'D_HR', D_Name: 'Human Resources', Parent_D_ID: board.D_ID, Status: 'Active' }
    });
    console.log('Departments created.');

    // 3. MEMBERS & ACCOUNTS
    // Password hash for '123456'
    const passwordHash = await bcrypt.hash('123456', 10);

    const users = [
        {
            m_id: 'M_ADMIN', name: 'Super Admin', email: 'admin@work.com', username: 'admin',
            r_id: 'R_ADMIN', d_id: 'D_IT'
        },
        {
            m_id: 'M_DIR', name: 'Director One', email: 'director@work.com', username: 'director',
            r_id: 'R_DIRECTOR', d_id: 'D_BOARD'
        },
        {
            m_id: 'M_PMO', name: 'PMO Manager', email: 'pmo@work.com', username: 'pmo',
            r_id: 'R_PMO', d_id: 'D_IT'
        },
        {
            m_id: 'M_LEADER1', name: 'IT Leader', email: 'leader_it@work.com', username: 'leader_it',
            r_id: 'R_LEADER', d_id: 'D_IT'
        },
        {
            m_id: 'M_STAFF1', name: 'IT Staff One', email: 'staff1_it@work.com', username: 'staff1',
            r_id: 'R_STAFF', d_id: 'D_IT'
        },
        {
            m_id: 'M_STAFF2', name: 'IT Staff Two', email: 'staff2_it@work.com', username: 'staff2',
            r_id: 'R_STAFF', d_id: 'D_IT'
        },
        {
            m_id: 'M_LEADER2', name: 'HR Leader', email: 'leader_hr@work.com', username: 'leader_hr',
            r_id: 'R_LEADER', d_id: 'D_HR'
        },
        {
            m_id: 'M_STAFF3', name: 'HR Staff One', email: 'staff1_hr@work.com', username: 'staff3',
            r_id: 'R_STAFF', d_id: 'D_HR'
        }
    ];

    for (const u of users) {
        // Create Member
        await prisma.member.create({
            data: {
                M_ID: u.m_id,
                FullName: u.name,
                D_ID: u.d_id,
                JoinDate: new Date(),
                Status: 'Active'
            }
        });

        // Create Account
        // A_ID will be simple concatenation 'A_' + username for predictability
        await prisma.account.create({
            data: {
                A_ID: `A_${u.username.toUpperCase()}`,
                UserName: u.username,
                PassWord: passwordHash,
                Email: u.email,
                R_ID: u.r_id,
                M_ID: u.m_id,
                Status: 'Active',
                IsDeleted: false,
                Avatar: `https://ui-avatars.com/api/?name=${u.name.replace(' ', '+')}`
            }
        });
    }
    console.log('Members and Accounts created.');

    // 4. PROJECTS
    const p1 = await prisma.project.create({
        data: {
            P_ID: 'P_001',
            P_Name: 'Website Overhaul',
            D_ID: 'D_IT',
            Created_By_A_ID: 'A_ADMIN',
            Status: 'Active',
            Begin_Date: new Date(),
            End_Date: new Date(new Date().setDate(new Date().getDate() + 30))
        }
    });

    const p2 = await prisma.project.create({
        data: {
            P_ID: 'P_002',
            P_Name: 'Recruitment Drive 2026',
            D_ID: 'D_HR',
            Created_By_A_ID: 'A_DIRECTOR',
            Status: 'Active',
            Begin_Date: new Date(),
            End_Date: new Date(new Date().setDate(new Date().getDate() + 60))
        }
    });
    console.log('Projects created.');

    // 5. TASKS
    // Task 1: Assigned to IT Staff One (by Leader IT)
    const t1 = await prisma.task.create({
        data: {
            T_ID: 'T_001',
            Title: 'Fix Login Bugs',
            Description: 'Resolve the issue with the login API.',
            P_ID: 'P_001',
            Created_By_A_ID: 'A_LEADER_IT', // Leader creates
            Status: 'Todo',
            Priority: 'High',
            Begin_Date: new Date(),
            Due_Date: new Date(new Date().setDate(new Date().getDate() + 5)),
            // Main assignee in old field (optional, but good for backward compat if any)
            Assigned_ID_M_ID: 'M_STAFF1'
        }
    });

    // Task Member relation for T1
    await prisma.task_Member.create({
        data: { T_ID: 'T_001', M_ID: 'M_STAFF1', Role: 'Assignee' }
    });

    // Task 2: Assigned to IT Staff Two (by Leader IT)
    const t2 = await prisma.task.create({
        data: {
            T_ID: 'T_002',
            Title: 'Database Optimization',
            Description: 'Index the core tables.',
            P_ID: 'P_001',
            Created_By_A_ID: 'A_LEADER_IT', // Leader creates
            Status: 'Processing',
            Priority: 'Medium',
            Begin_Date: new Date(),
            Due_Date: new Date(new Date().setDate(new Date().getDate() + 10)),
            Assigned_ID_M_ID: 'M_STAFF2'
        }
    });
    await prisma.task_Member.create({
        data: { T_ID: 'T_002', M_ID: 'M_STAFF2', Role: 'Assignee' }
    });

    // Task 3: HR Task
    const t3 = await prisma.task.create({
        data: {
            T_ID: 'T_003',
            Title: 'Screen Candidates',
            Description: 'Review resumes for the new opening.',
            P_ID: 'P_002',
            Created_By_A_ID: 'A_LEADER_HR',
            Status: 'Pending',
            Priority: 'Normal',
            Begin_Date: new Date(),
            Due_Date: new Date(new Date().setDate(new Date().getDate() + 7)),
            Assigned_ID_M_ID: 'M_STAFF3'
        }
    });
    await prisma.task_Member.create({
        data: { T_ID: 'T_003', M_ID: 'M_STAFF3', Role: 'Assignee' }
    });

    console.log('Tasks created.');
    console.log('Seeding finished.');
}


main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
