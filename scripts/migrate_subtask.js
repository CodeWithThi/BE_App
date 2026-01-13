import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Adding Parent_T_ID column to Task table...');

    try {
        // Add column
        await prisma.$executeRawUnsafe(`
      ALTER TABLE \`Task\` 
      ADD COLUMN \`Parent_T_ID\` VARCHAR(10) NULL 
      AFTER \`Created_By_A_ID\`
    `);
        console.log('✓ Column added.');

        // Add index
        await prisma.$executeRawUnsafe(`
      ALTER TABLE \`Task\` 
      ADD INDEX \`FK_Task_ParentTask\` (\`Parent_T_ID\`)
    `);
        console.log('✓ Index added.');

        // Add foreign key
        await prisma.$executeRawUnsafe(`
      ALTER TABLE \`Task\` 
      ADD CONSTRAINT \`FK_Task_ParentTask\` 
      FOREIGN KEY (\`Parent_T_ID\`) 
      REFERENCES \`Task\`(\`T_ID\`) 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);
        console.log('✓ Foreign key constraint added.');

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        if (error.message.includes('Duplicate column name')) {
            console.log('⚠️  Column already exists, skipping...');
        } else {
            throw error;
        }
    }
}

main()
    .catch((e) => {
        console.error('❌ Migration failed:', e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
