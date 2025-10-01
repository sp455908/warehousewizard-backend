-- Migration script to add workflow fields to existing tables
-- Run this script to update the database schema

-- Add workflow fields to Quote table
ALTER TABLE "Quote" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "flowType" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Add workflow fields to Booking table
ALTER TABLE "Booking" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Add workflow fields to RFQ table
ALTER TABLE "RFQ" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Add workflow fields to Rate table
ALTER TABLE "Rate" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Add workflow fields to CargoDispatchDetail table
ALTER TABLE "CargoDispatchDetail" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Add workflow fields to CartingDetail table
ALTER TABLE "CartingDetail" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Add workflow fields to DeliveryAdvice table
ALTER TABLE "DeliveryAdvice" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Add workflow fields to DeliveryOrder table
ALTER TABLE "DeliveryOrder" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Add workflow fields to DeliveryReport table
ALTER TABLE "DeliveryReport" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Add workflow fields to Invoice table
ALTER TABLE "Invoice" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Add workflow fields to DeliveryRequest table
ALTER TABLE "DeliveryRequest" 
ADD COLUMN IF NOT EXISTS "currentWorkflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "workflowHistory" JSONB;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_quote_workflow_step" ON "Quote"("currentWorkflowStep");
CREATE INDEX IF NOT EXISTS "idx_booking_workflow_step" ON "Booking"("currentWorkflowStep");
CREATE INDEX IF NOT EXISTS "idx_rfq_workflow_step" ON "RFQ"("currentWorkflowStep");
CREATE INDEX IF NOT EXISTS "idx_rate_workflow_step" ON "Rate"("currentWorkflowStep");

-- Update existing records with default workflow step
UPDATE "Quote" 
SET "currentWorkflowStep" = 'C1', 
    "flowType" = 'FLOW_A_SAME_WAREHOUSE',
    "workflowHistory" = '[]'::jsonb
WHERE "currentWorkflowStep" IS NULL;

UPDATE "Booking" 
SET "currentWorkflowStep" = 'C17',
    "workflowHistory" = '[]'::jsonb
WHERE "currentWorkflowStep" IS NULL;

UPDATE "RFQ" 
SET "currentWorkflowStep" = 'C2',
    "workflowHistory" = '[]'::jsonb
WHERE "currentWorkflowStep" IS NULL;

UPDATE "Rate" 
SET "currentWorkflowStep" = 'C3',
    "workflowHistory" = '[]'::jsonb
WHERE "currentWorkflowStep" IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN "Quote"."currentWorkflowStep" IS 'Current step in the workflow (C1-C33)';
COMMENT ON COLUMN "Quote"."flowType" IS 'Type of workflow flow (FLOW_A_SAME_WAREHOUSE or FLOW_B_MULTIPLE_WAREHOUSES)';
COMMENT ON COLUMN "Quote"."workflowHistory" IS 'JSON array of workflow step transitions';

COMMENT ON COLUMN "Booking"."currentWorkflowStep" IS 'Current step in the booking workflow';
COMMENT ON COLUMN "Booking"."workflowHistory" IS 'JSON array of booking workflow step transitions';

COMMENT ON COLUMN "RFQ"."currentWorkflowStep" IS 'Current step in the RFQ workflow';
COMMENT ON COLUMN "RFQ"."workflowHistory" IS 'JSON array of RFQ workflow step transitions';

COMMENT ON COLUMN "Rate"."currentWorkflowStep" IS 'Current step in the rate workflow';
COMMENT ON COLUMN "Rate"."workflowHistory" IS 'JSON array of rate workflow step transitions';
