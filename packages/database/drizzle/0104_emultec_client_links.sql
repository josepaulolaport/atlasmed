CREATE TYPE "public"."emultec_client_link_source" AS ENUM('MANUAL', 'AUTO_CNPJ', 'AUTO_CPF');--> statement-breakpoint
CREATE TABLE "facility_emultec_clients" (
	"id_cliente_emultec" bigint PRIMARY KEY NOT NULL,
	"facility_id" bigint NOT NULL,
	"source" "emultec_client_link_source" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_emultec_clients" ADD CONSTRAINT "facility_emultec_clients_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_emultec_clients_facility_id_idx" ON "facility_emultec_clients" USING btree ("facility_id");--> statement-breakpoint
--
-- Carry over every link already recorded on facilities.id_cliente_emultec.
--
-- Those were established by hand, so they are MANUAL by definition. The column
-- stays for one release as a rollback target and is no longer read by anything;
-- a later migration drops it.
--
-- Only live facilities: a deactivated row holding a client id would otherwise
-- claim that client's primary key and shadow the active facility it belongs to.
--
INSERT INTO "facility_emultec_clients" ("id_cliente_emultec", "facility_id", "source")
SELECT "id_cliente_emultec", "id", 'MANUAL'
FROM "facilities"
WHERE "id_cliente_emultec" IS NOT NULL
  AND "deactivated_at" IS NULL
ON CONFLICT ("id_cliente_emultec") DO NOTHING;
