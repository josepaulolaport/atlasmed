import { DrizzleOrderRepository } from "./infrastructure/repositories/drizzle/drizzle-order.repository";
import {
  CreateOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
  type MetricSnapshotRecomputeQueue,
} from "./application/use-cases/orders.use-cases";
import { startMetricSnapshotTriggerWorkflow } from "../../infrastructure/temporal/temporal.client";

export const ordersRepositories = {
  order: new DrizzleOrderRepository(),
};

/**
 * Transport for the recompute an order write asks for (spec 0013 §4.4): a
 * Temporal workflow started from the API, the same shape `purchaseRecurrence`
 * already uses for a per-profile value derived from these same orders.
 */
const metricSnapshotQueue: MetricSnapshotRecomputeQueue = {
  enqueue: (input) => startMetricSnapshotTriggerWorkflow(input),
};

export const ordersUseCases = {
  listOrders: () => new ListOrdersUseCase({
    orderRepository: ordersRepositories.order,
  }),
  getOrder: () => new GetOrderUseCase({ orderRepository: ordersRepositories.order }),
  createOrder: () =>
    new CreateOrderUseCase({
      orderRepository: ordersRepositories.order,
      metricSnapshotQueue,
    }),
};
