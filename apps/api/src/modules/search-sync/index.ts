import { Elysia } from "elysia";
import { searchSyncRoutes } from "./infrastructure/routes/search-sync.route";

export const searchSync = new Elysia({
  name: "search-sync",
  detail: { tags: ["Search Sync"] },
}).use(searchSyncRoutes);
