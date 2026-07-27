ALTER TABLE "users" ADD COLUMN "avatar_blurhash" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "image_blurhash" text;--> statement-breakpoint
ALTER TABLE "facility_photos" ADD COLUMN "blurhash" text;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "image_blurhash" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "picture_blurhash" text;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "image_url";