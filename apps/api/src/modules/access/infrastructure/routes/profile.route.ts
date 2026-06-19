import { Elysia } from "elysia";
import { updateProfileSchema } from "@atlasmed/access";
import { accessUseCases, auth } from "../../composition";
import { serializeUser } from "./user.serializer";
import { profileRateLimit } from "../middleware/rate-limit.middleware";

export const profileRoute = new Elysia()
  .use(auth)
  .use(profileRateLimit)
  .get("/profile", async ({ getUser }) => {
    const user = await getUser();
    return serializeUser(user);
  })
  .patch("/profile", async ({ getUserId, body }: any) => {
    const userId = await getUserId();
    const parsed = updateProfileSchema.parse(body);

    const updatedUser = await accessUseCases.updateProfile().execute({
      userId,
      ...parsed,
    });

    return serializeUser(updatedUser);
  });
