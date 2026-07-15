import { Elysia } from "elysia";
import { ordersRoute } from "./infrastructure/routes/orders.route";

export const orders = new Elysia({
  name: "orders",
  detail: { tags: ["Orders"] },
}).use(ordersRoute);
