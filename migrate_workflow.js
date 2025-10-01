const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateWorkflowFields() {
  try {
    console.log('Starting workflow fields migration...');

    // Add workflow fields to Quote table
    await prisma.$executeRaw`
      ALTER TABLE "Quote" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "flowType" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Add workflow fields to Booking table
    await prisma.$executeRaw`
      ALTER TABLE "Booking" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Add workflow fields to RFQ table
    await prisma.$executeRaw`
      ALTER TABLE "RFQ" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Add workflow fields to Rate table
    await prisma.$executeRaw`
      ALTER TABLE "Rate" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Add workflow fields to CargoDispatchDetail table
    await prisma.$executeRaw`
      ALTER TABLE "CargoDispatchDetail" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Add workflow fields to CartingDetail table
    await prisma.$executeRaw`
      ALTER TABLE "CartingDetail" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Add workflow fields to DeliveryAdvice table
    await prisma.$executeRaw`
      ALTER TABLE "DeliveryAdvice" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Add workflow fields to DeliveryOrder table
    await prisma.$executeRaw`
      ALTER TABLE "DeliveryOrder" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Add workflow fields to DeliveryReport table
    await prisma.$executeRaw`
      ALTER TABLE "DeliveryReport" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Add workflow fields to Invoice table
    await prisma.$executeRaw`
      ALTER TABLE "Invoice" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Add workflow fields to DeliveryRequest table
    await prisma.$executeRaw`
      ALTER TABLE "DeliveryRequest" 
      ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
      ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;
    `;

    // Create indexes for better performance
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_quote_workflow_step" ON "Quote"("currentWorkflowStep");
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_booking_workflow_step" ON "Booking"("currentWorkflowStep");
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_rfq_workflow_step" ON "RFQ"("currentWorkflowStep");
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_rate_workflow_step" ON "Rate"("currentWorkflowStep");
    `;

    // Update existing records with default workflow step
    await prisma.$executeRaw`
      UPDATE "Quote" 
      SET "currentWorkflowStep" = 'C1', 
          "flowType" = 'FLOW_A_SAME_WAREHOUSE',
          "workflowHistory" = '[]'::jsonb
      WHERE "currentWorkflowStep" IS NULL;
    `;

    await prisma.$executeRaw`
      UPDATE "Booking" 
      SET "currentWorkflowStep" = 'C17',
          "workflowHistory" = '[]'::jsonb
      WHERE "currentWorkflowStep" IS NULL;
    `;

    await prisma.$executeRaw`
      UPDATE "RFQ" 
      SET "currentWorkflowStep" = 'C2',
          "workflowHistory" = '[]'::jsonb
      WHERE "currentWorkflowStep" IS NULL;
    `;

    await prisma.$executeRaw`
      UPDATE "Rate" 
      SET "currentWorkflowStep" = 'C3',
          "workflowHistory" = '[]'::jsonb
      WHERE "currentWorkflowStep" IS NULL;
    `;

    console.log('✅ Workflow fields migration completed successfully!');
    console.log('Added workflow fields to all tables and updated existing records.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateWorkflowFields()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
