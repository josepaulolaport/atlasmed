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
}

const commandSchema = z.object({ expectedVersion: z.number().int().nonnegative() });
const completeSchema = commandSchema.extend({ correctionReason: z.string().trim().min(1).optional() });

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

export function createInteractionRoutes(useCases: InteractionHttpUseCases = interactionUseCases, authPlugin: any = auth) {
  // Security registry requires the production route to visibly declare `.use(auth)`;
  // injected tests supply an equivalent scoped auth plugin through authPlugin.
  const get = new Elysia().use(authPlugin).use(requirePermission("read", "INTERACTION", { resourceIdParam: "id" }))
    .get("/interactions/:id", async (ctx) => useCases.get().execute({ ...(await context(ctx)), id: ctx.params.id }), {
      detail: { summary: "Get interaction workspace", tags: ["Interactions"], security: [{ bearerAuth: [] }] },
    });
  const start = new Elysia().use(authPlugin).use(requirePermission("update", "INTERACTION", { resourceIdParam: "id" }))
    .post("/interactions/:id/start", async (ctx) => useCases.start().execute({ ...(await context(ctx)), id: ctx.params.id,
      idempotencyKey: commandKey(ctx.request.headers), ...parse(commandSchema, ctx.body) }), {
      body: t.Object({ expectedVersion: t.Number() }),
      detail: { summary: "Start interaction", tags: ["Interactions"], security: [{ bearerAuth: [] }] },
    });
  const complete = new Elysia().use(authPlugin).use(requirePermission("update", "INTERACTION", { resourceIdParam: "id" }))
    .post("/interactions/:id/complete", async (ctx) => useCases.complete().execute({ ...(await context(ctx)), id: ctx.params.id,
      idempotencyKey: commandKey(ctx.request.headers), ...parse(completeSchema, ctx.body) }), {
      body: t.Object({ expectedVersion: t.Number(), correctionReason: t.Optional(t.String()) }),
      detail: { summary: "Complete interaction", tags: ["Interactions"], security: [{ bearerAuth: [] }] },
    });
  return new Elysia().use(get).use(start).use(complete);
}

export const interactionsRoute = createInteractionRoutes();
