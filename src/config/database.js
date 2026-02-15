// src/config/database.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
    ],
});

// Slow query logging — cảnh báo query chậm hơn 200ms
prisma.$on('query', (e) => {
    if (e.duration > 200) {
        console.warn(`🐌 [SLOW QUERY] ${e.duration}ms — ${e.query}`);
    }
});

// Graceful shutdown — đóng connection pool khi process tắt
const shutdown = async () => {
    console.log('🔌 Disconnecting Prisma...');
    await prisma.$disconnect();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default prisma;
