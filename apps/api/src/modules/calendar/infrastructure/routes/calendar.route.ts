import { Elysia, t } from "elysia";
import { z } from "zod";
import type { ScopeContext, Role } from "@atlasmed/access";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ValidationError } from "../../../../shared/errors";
import { calendarUseCases } from "../../composition";

type Executable = { execute(input: any): Promise<any> };
export interface CalendarHttpUseCases {
  list(): Executable; availability(): Executable; create(): Executable; update(): Executable;
  updateOccurrence(): Executable; cancel(): Executable; cancelOccurrence(): Executable;
}

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const validTimeZone = (value: string) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } };
const dateRangeSchema = z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }), ownerUserId: z.string().min(1).optional() })
  .refine((value) => new Date(value.from) < new Date(value.to), { path: ["to"], message: "to must be after from" })
  .refine((value) => new Date(value.to).getTime() - new Date(value.from).getTime() <= MAX_RANGE_MS, { path: ["to"], message: "Calendar range may not exceed 366 days" });
const baseEvent = z.object({
  title: z.string().trim().min(1), startsAt: z.string().datetime({ offset: true }), timeZone: z.string().refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid IANA time zone"),
  durationMinutes: z.number().int().positive().refine((value) => value % 30 === 0, "durationMinutes must be a multiple of 30"),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]), recurrenceUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), recurrenceCount: z.number().int().positive().optional(),
}).refine((value) => !(value.recurrenceUntil && value.recurrenceCount), { path: ["recurrenceUntil"], message: "recurrenceUntil and recurrenceCount are mutually exclusive" });
const createSchema = z.discriminatedUnion("kind", [
  baseEvent.extend({ kind: z.literal("INTERACTION"), facilityId: z.string().min(1), modality: z.enum(["IN_PERSON", "REMOTE"]) }),
  baseEvent.extend({ kind: z.literal("PERSONAL_BLOCK"), facilityId: z.never().optional(), modality: z.never().optional() }),
]);
const expectedVersionSchema = z.number().int().nonnegative();
const updateSchema = z.object({ expectedVersion: expectedVersionSchema, title: z.string().trim().min(1).optional(), startsAt: z.string().datetime({ offset: true }).optional(),
  timeZone: z.string().refine(validTimeZone, "Invalid IANA time zone").optional(), durationMinutes: z.number().int().positive().refine((value) => value % 30 === 0, "durationMinutes must be a multiple of 30").optional(), recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
  recurrenceUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), recurrenceCount: z.number().int().positive().nullable().optional() })
  .superRefine((value, ctx) => {
    if (value.recurrenceUntil && value.recurrenceCount) ctx.addIssue({ code: "custom", path: ["recurrenceUntil"], message: "recurrenceUntil and recurrenceCount are mutually exclusive" });
    if (value.recurrence === "NONE" && (value.recurrenceUntil || value.recurrenceCount)) ctx.addIssue({ code: "custom", path: ["recurrence"], message: "NONE recurrence cannot have bounds" });
  });
const occurrenceUpdateSchema = z.object({ expectedVersion: expectedVersionSchema, startsAt: z.string().datetime({ offset: true }), durationMinutes: z.number().int().positive().refine((value) => value % 30 === 0) });
const cancellationSchema = z.object({ expectedVersion: expectedVersionSchema, reason: z.string().trim().min(1) });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError(result.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message })));
  return result.data;
}
function commandKey(headers: Headers) {
  const value = headers.get("idempotency-key")?.trim();
  if (!value) throw new ValidationError([{ field: "idempotency-key", message: "Idempotency-Key header is required" }]);
  return value;
}
async function context(input: any) {
  const [scope, userId, authContext] = await Promise.all([input.getScope(), input.getUserId(), input.getAuthContext()]);
  return { scope, actor: { userId, roleName: authContext.roleName } };
}

const dateRangeType = t.Object({ from: t.String(), to: t.String(), ownerUserId: t.Optional(t.String()) });
const createType = t.Object({ kind: t.Union([t.Literal("INTERACTION"), t.Literal("PERSONAL_BLOCK")]), title: t.String(), facilityId: t.Optional(t.String()), modality: t.Optional(t.Union([t.Literal("IN_PERSON"), t.Literal("REMOTE")])), startsAt: t.String(), timeZone: t.String(), durationMinutes: t.Number(), recurrence: t.Union([t.Literal("NONE"), t.Literal("DAILY"), t.Literal("WEEKLY"), t.Literal("MONTHLY"), t.Literal("YEARLY")]), recurrenceUntil: t.Optional(t.String()), recurrenceCount: t.Optional(t.Number()) });

export function createCalendarRoutes(useCases: CalendarHttpUseCases = calendarUseCases, authPlugin: any = auth) {
  // Security registry requires the production route to visibly declare `.use(auth)`;
  // injected tests supply an equivalent scoped auth plugin through authPlugin.
  const list = new Elysia().use(authPlugin).use(requirePermission("read", "CALENDAR")).get("/calendar", async (ctx) => {
    const query = parse(dateRangeSchema, ctx.query); return useCases.list().execute({ ...(await context(ctx)), ownerUserId: query.ownerUserId, from: new Date(query.from), to: new Date(query.to) });
  }, { query: dateRangeType, detail: { summary: "List calendar occurrences", tags: ["Calendar"], security: [{ bearerAuth: [] }] } });
  const availability = new Elysia().use(authPlugin).use(requirePermission("read", "CALENDAR")).get("/calendar/availability", async (ctx) => {
    const query = parse(dateRangeSchema, ctx.query); return useCases.availability().execute({ ...(await context(ctx)), ownerUserId: query.ownerUserId, from: new Date(query.from), to: new Date(query.to) });
  }, { query: dateRangeType, detail: { summary: "Get calendar occupied intervals", tags: ["Calendar"], security: [{ bearerAuth: [] }] } });
  const create = new Elysia().use(authPlugin).use(requirePermission("create", "CALENDAR")).post("/calendar", async (ctx) => useCases.create().execute({ ...(await context(ctx)), idempotencyKey: commandKey(ctx.request.headers), data: parse(createSchema, ctx.body) }),
    { body: createType, detail: { summary: "Create calendar event", tags: ["Calendar"], security: [{ bearerAuth: [] }] } });
  const update = new Elysia().use(authPlugin).use(requirePermission("update", "CALENDAR", { resourceIdParam: "id" })).patch("/calendar/:id", async (ctx) => {
    const body = parse(updateSchema, ctx.body); const { expectedVersion, ...changes } = body; return useCases.update().execute({ ...(await context(ctx)), id: ctx.params.id, idempotencyKey: commandKey(ctx.request.headers), expectedVersion, changes });
  }, { body: t.Object({ expectedVersion: t.Number(), title: t.Optional(t.String()), startsAt: t.Optional(t.String()), timeZone: t.Optional(t.String()), durationMinutes: t.Optional(t.Number()), recurrence: t.Optional(t.String()), recurrenceUntil: t.Optional(t.Nullable(t.String())), recurrenceCount: t.Optional(t.Nullable(t.Number())) }), detail: { summary: "Update calendar series", tags: ["Calendar"], security: [{ bearerAuth: [] }] } });
  const updateOccurrence = new Elysia().use(authPlugin).use(requirePermission("update", "CALENDAR", { resourceIdParam: "id" })).patch("/calendar/:id/occurrences/:recurrenceKey", async (ctx) => useCases.updateOccurrence().execute({ ...(await context(ctx)), id: ctx.params.id, recurrenceKey: decodeURIComponent(ctx.params.recurrenceKey), idempotencyKey: commandKey(ctx.request.headers), ...parse(occurrenceUpdateSchema, ctx.body) }),
    { body: t.Object({ expectedVersion: t.Number(), startsAt: t.String(), durationMinutes: t.Number() }), detail: { summary: "Reschedule calendar occurrence", tags: ["Calendar"], security: [{ bearerAuth: [] }] } });
  const cancel = new Elysia().use(authPlugin).use(requirePermission("delete", "CALENDAR", { resourceIdParam: "id" })).delete("/calendar/:id", async (ctx) => useCases.cancel().execute({ ...(await context(ctx)), id: ctx.params.id, idempotencyKey: commandKey(ctx.request.headers), ...parse(cancellationSchema, ctx.body) }),
    { body: t.Object({ expectedVersion: t.Number(), reason: t.String() }), detail: { summary: "Cancel calendar series", tags: ["Calendar"], security: [{ bearerAuth: [] }] } });
  const cancelOccurrence = new Elysia().use(authPlugin).use(requirePermission("delete", "CALENDAR", { resourceIdParam: "id" })).delete("/calendar/:id/occurrences/:recurrenceKey", async (ctx) => useCases.cancelOccurrence().execute({ ...(await context(ctx)), id: ctx.params.id, recurrenceKey: decodeURIComponent(ctx.params.recurrenceKey), idempotencyKey: commandKey(ctx.request.headers), ...parse(cancellationSchema, ctx.body) }),
    { body: t.Object({ expectedVersion: t.Number(), reason: t.String() }), detail: { summary: "Cancel calendar occurrence", tags: ["Calendar"], security: [{ bearerAuth: [] }] } });
  return new Elysia().use(list).use(availability).use(create).use(update).use(updateOccurrence).use(cancel).use(cancelOccurrence);
}

export const calendarRoute = createCalendarRoutes();
