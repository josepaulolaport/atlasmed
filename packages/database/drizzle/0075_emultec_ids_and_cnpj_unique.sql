ALTER TABLE "users" ADD COLUMN "id_vendedor_emultec" bigint;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "id_cliente_emultec" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "users_id_vendedor_emultec_uidx" ON "users" USING btree ("id_vendedor_emultec") WHERE "users"."id_vendedor_emultec" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_id_cliente_emultec_uidx" ON "facilities" USING btree ("id_cliente_emultec") WHERE "facilities"."id_cliente_emultec" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_active_legal_document_cnpj_uidx" ON "facilities" USING btree ("legal_document") WHERE "facilities"."deactivated_at" IS NULL AND "facilities"."legal_document" IS NOT NULL AND "facilities"."legal_document_type" = 'CNPJ';