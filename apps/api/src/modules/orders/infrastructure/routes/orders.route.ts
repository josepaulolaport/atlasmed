import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { ordersUseCases } from "../../composition";
import type { OrderStatus } from "../../application/interfaces/order.repository.interface";

const orderStatuses = [
  "DRAFT",
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
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
    async ({ query, getScope }) => {
      const scope = await getScope();
      return ordersUseCases.listOrders().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        statuses: parseStatuses(query.status),
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
        status: t.Optional(t.String({
          description: "Comma-separated statuses: PENDING,SHIPPED",
        })),
      }),
    }
  );

const getOrderRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/orders/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const order = await ordersUseCases.getOrder().execute({ orderId: params.id, scope });
      if (!order) throw new ResourceNotFoundError("Order", params.id);
      return order;
    },
    {
      detail: {
        summary: "Get order by id",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

export const ordersRoute = new Elysia().use(listOrdersRoute).use(getOrderRoute);
