import { Elysia } from "elysia";
import { avatarRoute } from "./avatar.route";

/**
 * Additive user API surface. The profile GET/PATCH implementation can be
 * merged here independently without changing this authenticated avatar route.
 */
export const user = new Elysia({ name: "user", prefix: "/user" }).use(avatarRoute);
