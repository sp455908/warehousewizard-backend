-- Step 1: Add new enum values to the existing StorageType enum
ALTER TYPE "StorageType" ADD VALUE 'domestic_dry';
ALTER TYPE "StorageType" ADD VALUE 'domestic_reefer';
ALTER TYPE "StorageType" ADD VALUE 'bonded_dry';
ALTER TYPE "StorageType" ADD VALUE 'bonded_reefer';
ALTER TYPE "StorageType" ADD VALUE 'cfs_import';
ALTER TYPE "StorageType" ADD VALUE 'cfs_export_dry';
ALTER TYPE "StorageType" ADD VALUE 'cfs_export_reefer';

-- Step 2: Update existing data to use new enum values
UPDATE "Warehouse" 
SET "storageType" = CASE 
    WHEN "storageType"::text = 'dry_storage' THEN 'domestic_dry'::"StorageType"
    WHEN "storageType"::text = 'cold_storage' THEN 'domestic_reefer'::"StorageType"
    WHEN "storageType"::text = 'hazmat' THEN 'bonded_dry'::"StorageType"
    WHEN "storageType"::text = 'climate_controlled' THEN 'bonded_reefer'::"StorageType"
    ELSE 'domestic_dry'::"StorageType"
END
WHERE "storageType"::text IN ('dry_storage', 'cold_storage', 'hazmat', 'climate_controlled');