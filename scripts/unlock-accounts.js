// scripts/unlock-accounts.js
// Run with: npx tsx scripts/unlock-accounts.js

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function unlockAllAccounts() {
    console.log('Unlocking all locked accounts...');

    const result = await prisma.account.updateMany({
        where: {
            OR: [
                { LockedUntil: { not: null } },
                { FailedLoginAttempts: { gt: 0 } }
            ]
        },
        data: {
            LockedUntil: null,
            FailedLoginAttempts: 0
        }
    });

    console.log(`Successfully unlocked ${result.count} account(s).`);
    await prisma.$disconnect();
}

unlockAllAccounts().catch(console.error);
