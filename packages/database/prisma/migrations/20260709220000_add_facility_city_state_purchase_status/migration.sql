-- Add PurchaseStatus enum
CREATE TYPE "public"."PurchaseStatus" AS ENUM ('NAO_COMPRA', 'COMPRA', 'COMPRA_POUCO', 'COMPRA_MUITO');

-- Add new fields to facilities table
ALTER TABLE "public"."facilities" ADD COLUMN "purchase_status" "public"."PurchaseStatus";
ALTER TABLE "public"."facilities" ADD COLUMN "city" TEXT;
ALTER TABLE "public"."facilities" ADD COLUMN "state_code" TEXT;
