ALTER TABLE "facility_metric_snapshots" drop column "share";--> statement-breakpoint
ALTER TABLE "facility_metric_snapshots" ADD COLUMN "share" numeric(9, 8) GENERATED ALWAYS AS (case
            when (no_other_brands or theirs_qty > 0) and ours_qty + theirs_qty > 0
            then ours_qty / (ours_qty + theirs_qty)
          end) STORED;