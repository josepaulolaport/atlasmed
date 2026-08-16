ALTER TABLE "roteiro_stop_rejections" ALTER COLUMN "roteiro_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "roteiro_stop_rejections" ALTER COLUMN "position" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "roteiro_stop_rejections" ADD COLUMN "user_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "roteiro_stop_rejections" ADD COLUMN "vertical_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "roteiro_stop_rejections" ADD CONSTRAINT "roteiro_stop_rejections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_stop_rejections" ADD CONSTRAINT "roteiro_stop_rejections_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "public"."business_verticals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roteiro_stop_rejections_user_profile_idx" ON "roteiro_stop_rejections" USING btree ("user_id","rejected_profile_id","created_at");