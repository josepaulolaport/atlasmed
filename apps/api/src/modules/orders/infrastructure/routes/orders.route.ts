import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { ordersUseCases } from "../../composition";
import type { OrderStatus } from "../../application/interfaces/order.repository.interface";

type Executable = { execute(input: any): Promise<any> };
export interface OrdersHttpUseCases {
  listOrders(): Executable;
  getOrder(): Executable;
  createOrder(): Executable;
}

const orderStatuses = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "INVOICED",
  "REJECTED",
  "NO_BILLING",
] as const;

function parseStatuses(status: string | undefined): OrderStatus[] | undefined {
  if (!status) return undefined;
  const values = status.split(",").map((value) => value.trim()).filter(Boolean);
  const invalid = values.filter((value) => !orderStatuses.includes(value as OrderStatus));
  if (invalid.length) {
    throw new ValidationError([{ field: "status", message: `Invalid order status: ${invalid.join(", ")}` }]);
  }
  return values as OrderStatus[];
}

function idempotencyKey(headers: Headers) {
  const value = headers.get("idempotency-key")?.trim();
  if (!value) {
    throw new ValidationError([
      { field: "idempotency-key", message: "Idempotency-Key header is required" },
    ]);
  }
  return value;
}

export function createOrdersRoutes(
  useCases: OrdersHttpUseCases = ordersUseCases,
  authPlugin: any = auth,
) {
  const listOrdersRoute = new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "FACILITY"))
    .get(
      "/orders",
      async ({ query, getScope, getUserId, getAuthContext }) => {
        const [scope, userId, authContext] = await Promise.all([
          getScope(),
          getUserId(),
          getAuthContext(),
        ]);
        return useCases.listOrders().execute({
          page: query.page ? Number(query.page) : undefined,
          limit: query.limit ? Number(query.limit) : undefined,
          statuses: parseStatuses(query.status),
          facilityId: query.facilityId,
          interactionId: query.interactionId,
          verticalId: query.verticalId,
          includeItemPreviews: query.includeItemPreviews === "true",
          actor: { userId, roleName: authContext.roleName },
          scope,
        });
      },
      {
        detail: {
          summary: "List orders",
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
        },
        query: t.Object({
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          facilityId: t.Optional(t.String()),
          interactionId: t.Optional(t.String()),
          verticalId: t.Optional(t.String()),
          includeItemPreviews: t.Optional(t.String({
            description: "When true, each order includes up to 2 item preview lines",
          })),
          status: t.Optional(t.String({
            description: "Comma-separated statuses: PENDING,APPROVED,INVOICED",
          })),
        }),
      },
    );

  const getOrderRoute = new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "FACILITY"))
    .get(
      "/orders/:id",
      async ({ params, query, getScope, getUserId, getAuthContext }) => {
        const [scope, userId, authContext] = await Promise.all([
          getScope(),
          getUserId(),
          getAuthContext(),
        ]);
        const order = await useCases.getOrder().execute({
          orderId: params.id,
          scope,
          actor: { userId, roleName: authContext.roleName },
          verticalId: query.verticalId,
        });
        if (!order) throw new ResourceNotFoundError("Order", params.id);
        return order;
      },
      {
        detail: {
          summary: "Get order by id",
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
        },
        query: t.Object({ verticalId: t.Optional(t.String()) }),
      },
    );

  const createOrderRoute = new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "FACILITY"))
    .post(
      "/orders",
      async ({ body, request, getScope, getUserId, getAuthContext }) => {
        const [scope, userId, authContext] = await Promise.all([
          getScope(),
          getUserId(),
          getAuthContext(),
        ]);
        return useCases.createOrder().execute({
          idempotencyKey: idempotencyKey(request.headers),
          facilityId: body.facilityId,
          interactionId: body.interactionId,
          verticalId: body.verticalId,
          professionalId: body.professionalId,
          status: body.status,
          type: body.type,
          notes: body.notes,
          freight: body.freight,
          orderedAt: body.orderedAt,
          items: body.items,
          scope,
          actor: { userId, roleName: authContext.roleName },
        });
      },
      {
        detail: {
          summary: "Create order",
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
        },
        body: t.Object({
          facilityId: t.String(),
          interactionId: t.Optional(t.String()),
          verticalId: t.Optional(t.String()),
          professionalId: t.Optional(t.Nullable(t.String())),
          status: t.Optional(t.Union([t.Literal("DRAFT"), t.Literal("PENDING")])),
          type: t.Optional(t.Union([
            t.Literal("SALE"),
            t.Literal("CONSIGNMENT"),
            t.Literal("DONATION"),
            t.Literal("OTHER"),
          ])),
          notes: t.Optional(t.Nullable(t.String())),
          freight: t.Optional(t.Number()),
          orderedAt: t.Optional(t.String()),
          items: t.Array(t.Object({
            productId: t.String(),
            quantity: t.Number(),
            unitPrice: t.Optional(t.Number()),
          }), { minItems: 1 }),
        }),
      },
    );

  return new Elysia()
    .use(listOrdersRoute)
    .use(createOrderRoute)
    .use(getOrderRoute);
}

export const ordersRoute = createOrdersRoutes();
