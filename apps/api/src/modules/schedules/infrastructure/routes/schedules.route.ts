import { Elysia } from "elysia";
import { ensureEmultecOrderImportSchedules } from "@atlasmed/temporal-worker/src/scripts/ensure-emultec-order-import-schedule";
import { ensurePurchaseRecurrenceSchedules } from "@atlasmed/temporal-worker/src/scripts/ensure-purchase-recurrence-schedule";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { environment } from "../../../../app/config/environment";
import { getTemporalClient } from "../../../../infrastructure/temporal/temporal.client";

export const scheduleRoutes = new Elysia()
  .use(auth)
  .use(requirePermission("manage", "SEARCH_SYNC"))
  .post(
    "/admin/schedules/purchase-recurrence",
    async ({ set }) => {
      const client = await getTemporalClient();
      await ensurePurchaseRecurrenceSchedules(client.schedule, {
        taskQueue: environment.TEMPORAL_TASK_QUEUE,
      });
      set.status = 202;
      return { ok: true };
    },
    {
      detail: {
        summary: "Provision the facility purchase-recurrence Temporal schedule",
        tags: ["Schedules"],
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .post(
    "/admin/schedules/emultec-order-import",
    async ({ set }) => {
      const client = await getTemporalClient();
      await ensureEmultecOrderImportSchedules(client.schedule, {
        taskQueue: environment.TEMPORAL_TASK_QUEUE,
      });
      set.status = 202;
      return { ok: true };
    },
    {
      detail: {
        summary: "Provision the Emultec order import Temporal schedule",
        tags: ["Schedules"],
        security: [{ bearerAuth: [] }],
      },
    }
  );
