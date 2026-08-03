import { DrizzleOrderRepository } from "./infrastructure/repositories/drizzle/drizzle-order.repository";
import { DrizzleInteractionContextPort } from "./infrastructure/repositories/drizzle/drizzle-interaction-context.port";
import {
  CreateOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
} from "./application/use-cases/orders.use-cases";

export const ordersPorts = {
  interactionContext: new DrizzleInteractionContextPort(),
};

export const ordersRepositories = {
  order: new DrizzleOrderRepository(undefined, ordersPorts.interactionContext),
};

export const ordersUseCases = {
  listOrders: () => new ListOrdersUseCase({
    orderRepository: ordersRepositories.order,
    interactionContextPort: ordersPorts.interactionContext,
  }),
  getOrder: () => new GetOrderUseCase({ orderRepository: ordersRepositories.order }),
  createOrder: () =>
    new CreateOrderUseCase({
      orderRepository: ordersRepositories.order,
      interactionContextPort: ordersPorts.interactionContext,
    }),
};
