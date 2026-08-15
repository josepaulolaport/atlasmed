import { Elysia, t } from "elysia";
import { z } from "zod";
import type { Role } from "@atlasmed/access";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ValidationError } from "../../../../shared/errors";
import { interactionUseCases } from "../../composition";

type Executable = { execute(input: any): Promise<any> };
export interface InteractionHttpUseCases {
  get(): Executable;
  start(): Executable;
  complete(): Executable;
  recordOutcome(): Executable;
}

const commandSchema = z.object({ expectedVersion: z.number().int().nonnegative() });
const completeSchema = commandSchema.extend({ correctionReason: z.string().trim().min(1).optional() });
// No expectedVersion: answering a question is not a state transition, and a
// visit closed for the rep by an arrival or by the job will already have moved
// on from whatever version their screen was holding.
const outcomeSchema = z.object({
  outcome: z.enum(["PEDIDO", "VAI_AVALIAR", "RELACIONAMENTO", "NAO_FALEI_COM_NINGUEM"]),
  followUp: z.enum(["NENHUM", "DIAS_15", "DIAS_30", "DIAS_90"]),
});

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
  return { scope, actor: { userId, roleName: authContext.roleName as Role } };
}

const interactionIdParams = t.Object({ id: t.Number({ minimum: 1 }) });

export function createInteractionRoutes(useCases: InteractionHttpUseCases = interactionUseCases, authPlugin: any = auth) {
  // Security registry requires the production route to visibly declare `.use(auth)`;
  // injected tests supply an equivalent scoped auth plugin through authPlugin.
  const get = new Elysia().use(authPlugin).use(requirePermission("read", "INTERACTION", { resourceIdParam: "id" }))
    .get("/interactions/:id", async (ctx) => useCases.get().execute({ ...(await context(ctx)), id: ctx.params.id }), {
      params: interactionIdParams,
      detail: { summary: "Get interaction workspace", tags: ["Interactions"], security: [{ bearerAuth: [] }] },
    });
  const start = new Elysia().use(authPlugin).use(requirePermission("update", "INTERACTION", { resourceIdParam: "id" }))
    .post("/interactions/:id/start", async (ctx) => useCases.start().execute({ ...(await context(ctx)), id: ctx.params.id,
      idempotencyKey: commandKey(ctx.request.headers), ...parse(commandSchema, ctx.body) }), {
      params: interactionIdParams,
      body: t.Object({ expectedVersion: t.Number() }),
      detail: { summary: "Start interaction", tags: ["Interactions"], security: [{ bearerAuth: [] }] },
    });
  const complete = new Elysia().use(authPlugin).use(requirePermission("update", "INTERACTION", { resourceIdParam: "id" }))
    .post("/interactions/:id/complete", async (ctx) => useCases.complete().execute({ ...(await context(ctx)), id: ctx.params.id,
      idempotencyKey: commandKey(ctx.request.headers), ...parse(completeSchema, ctx.body) }), {
      params: interactionIdParams,
      body: t.Object({ expectedVersion: t.Number(), correctionReason: t.Optional(t.String()) }),
      detail: { summary: "Complete interaction", tags: ["Interactions"], security: [{ bearerAuth: [] }] },
    });
  // §15.6.4 — the two questions. Its own route because most visits are closed
  // by an arrival or by the workday-end job, so the answers arrive after the
  // visit is already COMPLETED and there is no `complete` call to carry them.
  const outcome = new Elysia().use(authPlugin).use(requirePermission("update", "INTERACTION", { resourceIdParam: "id" }))
    .post("/interactions/:id/outcome", async (ctx) => useCases.recordOutcome().execute({ ...(await context(ctx)), id: ctx.params.id,
      ...parse(outcomeSchema, ctx.body) }), {
      params: interactionIdParams,
      body: t.Object({
        outcome: t.Union([t.Literal("PEDIDO"), t.Literal("VAI_AVALIAR"),
          t.Literal("RELACIONAMENTO"), t.Literal("NAO_FALEI_COM_NINGUEM")]),
        followUp: t.Union([t.Literal("NENHUM"), t.Literal("DIAS_15"),
          t.Literal("DIAS_30"), t.Literal("DIAS_90")]),
      }),
      detail: { summary: "Record how a visit went and when to return", tags: ["Interactions"], security: [{ bearerAuth: [] }] },
    });
  return new Elysia().use(get).use(start).use(complete).use(outcome);
}

export const interactionsRoute = createInteractionRoutes();
