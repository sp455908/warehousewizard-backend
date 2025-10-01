-- Check for duplicate RFQs (same quoteId + warehouseId)
SELECT 
  "quoteId", 
  "warehouseId",
  COUNT(*) as duplicate_count,
  array_agg(id) as rfq_ids,
  array_agg(status) as statuses,
  array_agg("createdAt") as created_dates
FROM "RFQ" 
WHERE "warehouseId" IS NOT NULL
GROUP BY "quoteId", "warehouseId" 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Check rates for these duplicate RFQs
SELECT 
  r."quoteId",
  r."warehouseId", 
  r.id as rfq_id,
  r.status as rfq_status,
  rt.id as rate_id,
  rt."baseRate",
  rt."totalRate",
  rt.status as rate_status
FROM "RFQ" r
LEFT JOIN "Rate" rt ON r.id = rt."rfqId"
WHERE r.id IN (
  SELECT id FROM "RFQ" 
  WHERE ("quoteId", "warehouseId") IN (
    SELECT "quoteId", "warehouseId" 
    FROM "RFQ" 
    WHERE "warehouseId" IS NOT NULL
    GROUP BY "quoteId", "warehouseId" 
    HAVING COUNT(*) > 1
  )
)
ORDER BY r."quoteId", r."warehouseId", r."createdAt";

-- To delete duplicate RFQs (keep the first one, delete the rest)
-- WARNING: Run this only after reviewing the duplicates above!
/*
WITH duplicate_rfqs AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY "quoteId", "warehouseId" ORDER BY "createdAt") as rn
  FROM "RFQ"
  WHERE "warehouseId" IS NOT NULL
)
DELETE FROM "RFQ" 
WHERE id IN (
  SELECT id FROM duplicate_rfqs WHERE rn > 1
);
*/