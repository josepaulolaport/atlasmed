import { DrizzleOrderRepository } from "./infrastructure/repositories/drizzle/drizzle-order.repository";
import { GetOrderUseCase, ListOrdersUseCase } from "./application/use-cases/orders.use-cases";

export const ordersRepositories = {
  order: new DrizzleOrderRepository(),
};

export const ordersUseCases = {
  listOrders: () => new ListOrdersUseCase({ orderRepository: ordersRepositories.order }),
  getOrder: () => new GetOrderUseCase({ orderRepository: ordersRepositories.order }),
};
