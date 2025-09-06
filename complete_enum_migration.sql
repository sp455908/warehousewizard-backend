-- Step 1: Update existing warehouse data to use new enum values
UPDATE "Warehouse" 
SET "storageType" = CASE 
    WHEN "storageType"::text = 'dry_storage' THEN 'domestic_dry'::"StorageType"
    WHEN "storageType"::text = 'cold_storage' THEN 'domestic_reefer'::"StorageType"
    WHEN "storageType"::text = 'hazmat' THEN 'bonded_dry'::"StorageType"
    WHEN "storageType"::text = 'climate_controlled' THEN 'bonded_reefer'::"StorageType"
    ELSE 'domestic_dry'::"StorageType"
END
WHERE "storageType"::text IN ('dry_storage', 'cold_storage', 'hazmat', 'climate_controlled');

-- Step 2: Remove old enum values (this requires recreating the enum type)
-- First, create a new enum with only the new values
CREATE TYPE "StorageType_new" AS ENUM (
    'domestic_dry',
    'domestic_reefer', 
    'bonded_dry',
    'bonded_reefer',
    'cfs_import',
    'cfs_export_dry',
    'cfs_export_reefer'
);

-- Step 3: Update the warehouse table to use the new enum
ALTER TABLE "Warehouse" 
ALTER COLUMN "storageType" TYPE "StorageType_new" 
USING "storageType"::text::"StorageType_new";

-- Step 4: Drop the old enum and rename the new one
DROP TYPE "StorageType";
ALTER TYPE "StorageType_new" RENAME TO "StorageType";