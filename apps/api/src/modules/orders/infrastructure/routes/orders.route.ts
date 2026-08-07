import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { ordersUseCases } from "../../composition";
import type { OrderStatus } from "../../application/interfaces/order.repository.interface";

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

const listOrdersRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/orders",
    async ({ query, getScope, getUserId, getAuthContext }) => {
      const [scope, userId, authContext] = await Promise.all([
        getScope(),
        getUserId(),
        getAuthContext(),
      ]);
      return ordersUseCases.listOrders().execute({
        page: query.page,
        limit: query.limit,
        statuses: parseStatuses(query.status),
        facilityId: query.facilityId,
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
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1 })),
        facilityId: t.Optional(t.Number({ minimum: 1 })),
        verticalId: t.Optional(t.Number({ minimum: 1 })),
        includeItemPreviews: t.Optional(t.String({
          description: "When true, each order includes up to 2 item preview lines",
        })),
        status: t.Optional(t.String({
          description: "Comma-separated statuses: PENDING,APPROVED,INVOICED",
        })),
      }),
    }
  );

const getOrderRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/orders/:id",
    async ({ params, query, getScope, getUserId, getAuthContext }) => {
      const [scope, userId, authContext] = await Promise.all([
        getScope(),
        getUserId(),
        getAuthContext(),
      ]);
      const order = await ordersUseCases.getOrder().execute({
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
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      query: t.Object({
        verticalId: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );

const createOrderRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY"))
  .post(
    "/orders",
    async ({ body, getScope, getUserId, getAuthContext }) => {
      const [scope, userId, authContext] = await Promise.all([
        getScope(),
        getUserId(),
        getAuthContext(),
      ]);
      return ordersUseCases.createOrder().execute({
        facilityId: body.facilityId,
        verticalId: body.verticalId,
        professionalId: body.professionalId ?? null,
        status: body.status,
        type: body.type,
        notes: body.notes,
        freight: body.freight,
        orderedAt: body.orderedAt,
        items: body.items.map((item) => ({
          ...item,
          productId: item.productId,
        })),
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
        facilityId: t.Number({ minimum: 1 }),
        verticalId: t.Optional(t.Number({ minimum: 1 })),
        professionalId: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
        status: t.Optional(t.Union([t.Literal("DRAFT"), t.Literal("PENDING")])),
        type: t.Optional(
          t.Union([
            t.Literal("SALE"),
            t.Literal("CONSIGNMENT"),
            t.Literal("DONATION"),
            t.Literal("OTHER"),
          ])
        ),
        notes: t.Optional(t.Nullable(t.String())),
        freight: t.Optional(t.Number()),
        orderedAt: t.Optional(t.String()),
        items: t.Array(
          t.Object({
            productId: t.Number({ minimum: 1 }),
            quantity: t.Number(),
            unitPrice: t.Optional(t.Number()),
          }),
          { minItems: 1 }
        ),
      }),
    }
  );

export const ordersRoute = new Elysia()
  .use(listOrdersRoute)
  .use(createOrderRoute)
  .use(getOrderRoute);
