-- Migration to update Rate table for simplified rate structure
-- This migration removes old complex fields and adds new simplified fields

-- First, drop the old columns that are no longer needed
ALTER TABLE "Rate" DROP COLUMN IF EXISTS "baseRate";
ALTER TABLE "Rate" DROP COLUMN IF EXISTS "surcharges";
ALTER TABLE "Rate" DROP COLUMN IF EXISTS "totalRate";
ALTER TABLE "Rate" DROP COLUMN IF EXISTS "validityDays";
ALTER TABLE "Rate" DROP COLUMN IF EXISTS "capacityConfirmed";
ALTER TABLE "Rate" DROP COLUMN IF EXISTS "tat";
ALTER TABLE "Rate" DROP COLUMN IF EXISTS "notes";

-- Add the new simplified columns
ALTER TABLE "Rate" ADD COLUMN "rate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Rate" ADD COLUMN "termsAndConditions" TEXT;
ALTER TABLE "Rate" ADD COLUMN "remark" TEXT;
