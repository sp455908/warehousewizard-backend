-- Migration script for the new workflow implementation
-- This script adds the new tables and enums for the complete workflow

-- Add new enum values to existing enums
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'warehouse_quote_requested';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'warehouse_quote_received';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'rate_confirmed';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'customer_confirmation_pending';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'booking_confirmed';

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'customer_confirmation_pending';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'supervisor_confirmation_pending';

ALTER TYPE "CargoStatus" ADD VALUE IF NOT EXISTS 'cdd_confirmed';
ALTER TYPE "CargoStatus" ADD VALUE IF NOT EXISTS 'carting_details_submitted';

ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'delivery_advice_created';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'delivery_order_created';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'delivery_report_created';

-- Create new enums
CREATE TYPE "RFQStatus" AS ENUM ('sent', 'responded', 'expired', 'cancelled');
CREATE TYPE "RateStatus" AS ENUM ('pending', 'accepted', 'rejected', 'expired');
CREATE TYPE "CartingStatus" AS ENUM ('submitted', 'confirmed', 'rejected');
CREATE TYPE "DeliveryAdviceStatus" AS ENUM ('created', 'sent', 'acknowledged');
CREATE TYPE "DeliveryOrderStatus" AS ENUM ('created', 'sent', 'acknowledged', 'executed');
CREATE TYPE "DeliveryReportStatus" AS ENUM ('created', 'sent', 'acknowledged');

-- Create RFQ table
CREATE TABLE "RFQ" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "RFQStatus" NOT NULL DEFAULT 'sent',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RFQ_pkey" PRIMARY KEY ("id")
);

-- Create Rate table
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "baseRate" DOUBLE PRECISION NOT NULL,
    "surcharges" JSONB,
    "totalRate" DOUBLE PRECISION NOT NULL,
    "validityDays" INTEGER NOT NULL,
    "capacityConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "tat" TEXT,
    "notes" TEXT,
    "status" "RateStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- Create CartingDetail table
CREATE TABLE "CartingDetail" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "dimensions" TEXT,
    "specialHandling" TEXT,
    "status" "CartingStatus" NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CartingDetail_pkey" PRIMARY KEY ("id")
);

-- Create DeliveryAdvice table
CREATE TABLE "DeliveryAdvice" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3) NOT NULL,
    "urgency" "DeliveryUrgency" NOT NULL DEFAULT 'standard',
    "instructions" TEXT,
    "status" "DeliveryAdviceStatus" NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryAdvice_pkey" PRIMARY KEY ("id")
);

-- Create DeliveryOrder table
CREATE TABLE "DeliveryOrder" (
    "id" TEXT NOT NULL,
    "deliveryAdviceId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "DeliveryOrderStatus" NOT NULL DEFAULT 'created',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryOrder_pkey" PRIMARY KEY ("id")
);

-- Create DeliveryReport table
CREATE TABLE "DeliveryReport" (
    "id" TEXT NOT NULL,
    "deliveryOrderId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "pod" TEXT,
    "grn" TEXT,
    "quantities" JSONB,
    "exceptions" TEXT,
    "status" "DeliveryReportStatus" NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryReport_pkey" PRIMARY KEY ("id")
);

-- Add unique constraints
CREATE UNIQUE INDEX "DeliveryOrder_orderNumber_key" ON "DeliveryOrder"("orderNumber");
CREATE UNIQUE INDEX "DeliveryReport_reportNumber_key" ON "DeliveryReport"("reportNumber");

-- Add foreign key constraints
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Rate" ADD CONSTRAINT "Rate_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartingDetail" ADD CONSTRAINT "CartingDetail_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartingDetail" ADD CONSTRAINT "CartingDetail_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryAdvice" ADD CONSTRAINT "DeliveryAdvice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryAdvice" ADD CONSTRAINT "DeliveryAdvice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_deliveryAdviceId_fkey" FOREIGN KEY ("deliveryAdviceId") REFERENCES "DeliveryAdvice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryReport" ADD CONSTRAINT "DeliveryReport_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryReport" ADD CONSTRAINT "DeliveryReport_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryReport" ADD CONSTRAINT "DeliveryReport_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryReport" ADD CONSTRAINT "DeliveryReport_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes for better performance
CREATE INDEX "RFQ_quoteId_idx" ON "RFQ"("quoteId");
CREATE INDEX "RFQ_warehouseId_idx" ON "RFQ"("warehouseId");
CREATE INDEX "RFQ_status_idx" ON "RFQ"("status");

CREATE INDEX "Rate_rfqId_idx" ON "Rate"("rfqId");
CREATE INDEX "Rate_warehouseId_idx" ON "Rate"("warehouseId");
CREATE INDEX "Rate_status_idx" ON "Rate"("status");

CREATE INDEX "CartingDetail_bookingId_idx" ON "CartingDetail"("bookingId");
CREATE INDEX "CartingDetail_warehouseId_idx" ON "CartingDetail"("warehouseId");
CREATE INDEX "CartingDetail_status_idx" ON "CartingDetail"("status");

CREATE INDEX "DeliveryAdvice_bookingId_idx" ON "DeliveryAdvice"("bookingId");
CREATE INDEX "DeliveryAdvice_customerId_idx" ON "DeliveryAdvice"("customerId");
CREATE INDEX "DeliveryAdvice_status_idx" ON "DeliveryAdvice"("status");

CREATE INDEX "DeliveryOrder_deliveryAdviceId_idx" ON "DeliveryOrder"("deliveryAdviceId");
CREATE INDEX "DeliveryOrder_bookingId_idx" ON "DeliveryOrder"("bookingId");
CREATE INDEX "DeliveryOrder_customerId_idx" ON "DeliveryOrder"("customerId");
CREATE INDEX "DeliveryOrder_warehouseId_idx" ON "DeliveryOrder"("warehouseId");
CREATE INDEX "DeliveryOrder_status_idx" ON "DeliveryOrder"("status");

CREATE INDEX "DeliveryReport_deliveryOrderId_idx" ON "DeliveryReport"("deliveryOrderId");
CREATE INDEX "DeliveryReport_bookingId_idx" ON "DeliveryReport"("bookingId");
CREATE INDEX "DeliveryReport_customerId_idx" ON "DeliveryReport"("customerId");
CREATE INDEX "DeliveryReport_warehouseId_idx" ON "DeliveryReport"("warehouseId");
CREATE INDEX "DeliveryReport_status_idx" ON "DeliveryReport"("status");