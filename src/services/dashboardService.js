import prisma from "../config/database.js";

const dashboardServices = {
    getStats: async (req) => {
        try {
            const actor = req.user;
            const role = (actor.roleName || '').toLowerCase();

            // Default empty stats
            const stats = {
                totalUsers: 0,
                totalProjects: 0,
                totalTasks: 0,
                activeUsers: 0,
                departmentCount: 0,
                projectsByStatus: [],
                tasksByStatus: [],
                loading: false
            };

            // 1. GLOBAL STATS (Everyone sees basic counts or filtered by permission? Let's give global for Admin/PMO)

            // Users Count
            stats.totalUsers = await prisma.account.count({ where: { IsDeleted: false } });

            // Online users (active within last 5 minutes)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            stats.activeUsers = await prisma.account.count({
                where: {
                    IsDeleted: false,
                    Last_Active: { gte: fiveMinutesAgo }
                }
            });

            // Departments
            stats.departmentCount = await prisma.department.count();

            // Projects
            stats.totalProjects = await prisma.project.count({ where: { IsDeleted: false } });

            // Tasks
            stats.totalTasks = await prisma.task.count({ where: { IsDeleted: false } });

            // 2. AGGREGATIONS

            // Projects by Status
            const projectGroups = await prisma.project.groupBy({
                by: ['Status'],
                _count: { P_ID: true },
                where: { IsDeleted: false }
            });
            stats.projectsByStatus = projectGroups.map(g => ({ status: g.Status, count: g._count.P_ID }));

            // Tasks by Status
            const taskGroups = await prisma.task.groupBy({
                by: ['Status'],
                _count: { T_ID: true },
                where: { IsDeleted: false }
            });
            stats.tasksByStatus = taskGroups.map(g => ({ status: g.Status, count: g._count.T_ID }));

            // Tasks by Priority
            const taskPriority = await prisma.task.groupBy({
                by: ['Priority'],
                _count: { T_ID: true },
                where: { IsDeleted: false }
            });
            stats.tasksByPriority = taskPriority.map(g => ({ priority: g.Priority, count: g._count.T_ID }));

            // 3. REPORTS SPECIFIC DATA (Added for ReportsPage)

            // Department Performance (Count tasks by Department)
            // Note: DB Schema: Task -> Member -> D_ID. Need complex query or Raw Query. 
            // Prisma groupBy on Relation is tricky. We can do it via Member.

            // Allow fetching full reports if requested (e.g. query param ?type=reports)
            if (req.query.type === 'reports') {

                // Status Distribution (Already calculated above as tasksByStatus)
                stats.statusData = stats.tasksByStatus.map(s => ({
                    name: s.status,
                    value: s.count,
                    color: s.status === 'completed' ? 'hsl(142, 71%, 45%)' :
                        s.status === 'in_progress' ? 'hsl(217, 91%, 50%)' : 'hsl(0, 0%, 50%)' // Simplistic mapping
                }));

                // Department Performance (approximate via Users in Dept)
                const departments = await prisma.department.findMany({
                    include: {
                        Member: {
                            include: {
                                Task: { select: { Status: true } }
                            }
                        }
                    }
                });

                stats.departmentData = departments.map(d => {
                    let total = 0;
                    let completed = 0;
                    let overdue = 0; // Logic for overdue needs date check

                    d.Member.forEach(m => {
                        total += m.Task.length;
                        completed += m.Task.filter(t => t.Status === 'completed').length;
                    });

                    return {
                        name: d.D_Name,
                        total,
                        completed,
                        overdue // Mock or refine
                    };
                });
            }

            // 4. LEADER SPECIFIC DATA (Team Workload)
            // If role is Leader, fetch members of their department
            if (role === 'leader') {
                // Find Leader's Department
                // actor is from req.user (Account). Need to find Member record.
                const leaderMember = await prisma.member.findFirst({
                    where: { A_ID: actor.id }
                });

                if (leaderMember && leaderMember.D_ID) {
                    const teamMembers = await prisma.member.findMany({
                        where: { D_ID: leaderMember.D_ID, IsDeleted: false },
                        include: {
                            Task: { select: { Status: true } }
                        }
                    });

                    stats.members = {
                        workload: teamMembers.map(m => ({
                            id: m.M_ID, // Use M_ID as identifier for tasks assignment check
                            name: m.FullName,
                            activeTasks: m.Task.filter(t => t.Status === 'in-progress' || t.Status === 'doing').length,
                            completedTasks: m.Task.filter(t => t.Status === 'completed' || t.Status === 'done').length
                        }))
                    };
                }
            }


            return { status: 200, data: stats };

        } catch (err) {
            console.error("GET DASHBOARD STATS ERROR:", err);
            return { status: 500, message: "Server error getting dashboard stats" };
        }
    }
};

export default dashboardServices;
