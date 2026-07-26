-- P1.5: one commercial vertical per order. Backfill existing rows → Ortopedia.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "vertical_id" text;--> statement-breakpoint
UPDATE "orders" AS o
SET "vertical_id" = bv.id
FROM "business_verticals" AS bv
WHERE o."vertical_id" IS NULL AND bv."code" = 'ORTOPEDIA';--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "orders" WHERE "vertical_id" IS NULL) THEN
    RAISE EXCEPTION 'orders.vertical_id backfill failed: rows without ORTOPEDIA vertical';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "vertical_id" SET NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_vertical_id_business_verticals_id_fk'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_vertical_id_business_verticals_id_fk"
      FOREIGN KEY ("vertical_id") REFERENCES "public"."business_verticals"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_vertical_id_idx" ON "orders" USING btree ("vertical_id");
