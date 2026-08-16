CREATE TABLE "ops"."purchase_recurrence_watermark" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"covered_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
