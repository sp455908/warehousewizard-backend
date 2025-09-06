-- Update existing warehouse storage types to match the new enum
UPDATE "Warehouse" 
SET "storageType" = CASE 
    WHEN "storageType"::text = 'dry_storage' THEN 'domestic_dry'::"StorageType"
    WHEN "storageType"::text = 'cold_storage' THEN 'domestic_reefer'::"StorageType"
    WHEN "storageType"::text = 'hazmat' THEN 'bonded_dry'::"StorageType"
    WHEN "storageType"::text = 'climate_controlled' THEN 'bonded_reefer'::"StorageType"
    ELSE 'domestic_dry'::"StorageType" -- default fallback
END
WHERE "storageType"::text IN ('dry_storage', 'cold_storage', 'hazmat', 'climate_controlled');