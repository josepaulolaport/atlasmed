import { DrizzleOrderRepository } from "./infrastructure/repositories/drizzle/drizzle-order.repository";
import { DrizzleInteractionContextPort } from "./infrastructure/repositories/drizzle/drizzle-interaction-context.port";
import {
  CreateOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
} from "./application/use-cases/orders.use-cases";

export const ordersRepositories = {
  order: new DrizzleOrderRepository(),
};

export const ordersPorts = {
  interactionContext: new DrizzleInteractionContextPort(),
};

export const ordersUseCases = {
  listOrders: () => new ListOrdersUseCase({ orderRepository: ordersRepositories.order }),
  getOrder: () => new GetOrderUseCase({ orderRepository: ordersRepositories.order }),
  createOrder: () =>
    new CreateOrderUseCase({
      orderRepository: ordersRepositories.order,
      interactionContextPort: ordersPorts.interactionContext,
    }),
};
