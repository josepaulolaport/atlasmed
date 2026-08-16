import { Elysia } from "elysia";
import { roteiroRoute } from "./infrastructure/routes/roteiro.route";

export const roteiro = new Elysia({ name: "roteiro", detail: { tags: ["Roteiro"] } }).use(
  roteiroRoute(),
);
