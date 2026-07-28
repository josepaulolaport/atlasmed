import { Elysia, t } from "elysia";
import { accessUseCases, auth } from "../access/composition";
import { AvatarStorageAdapter } from "../access/infrastructure/avatar-storage/avatar-storage.adapter";
import { serializeUser } from "../access/infrastructure/routes/user.serializer";
import { ValidationError } from "../../shared/errors";

const avatarStorage = new AvatarStorageAdapter();
const contentTypesByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function avatarContentType(key: string): string {
  const extension = key.split(".").at(-1);
  return extension ? (contentTypesByExtension[extension] ?? "application/octet-stream") : "application/octet-stream";
}

export const avatarRoute = new Elysia({
  detail: { tags: ["User"], security: [{ bearerAuth: [] }] },
})
  .use(auth)
  .post(
    "/avatar",
    async ({ getUserId, body }: any) => {
      const avatar = body.avatar;
      if (!(avatar instanceof File)) {
        throw new ValidationError([{ field: "avatar", message: "Avatar file is required" }]);
      }

      const user = await accessUseCases.updateAvatar().upload({
        userId: await getUserId(),
        file: avatar,
      });
      return { user: serializeUser(user) };
    },
    {
      detail: {
        summary: "Upload profile avatar",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({ avatar: t.File({ description: "JPEG, PNG, or WebP image up to 5 MB" }) }),
    },
  )
  .delete("/avatar", async ({ getUserId }: any) => {
    const user = await accessUseCases.updateAvatar().remove({ userId: await getUserId() });
    return { user: serializeUser(user) };
  }, {
    detail: { summary: "Remove profile avatar", tags: ["User"], security: [{ bearerAuth: [] }] },
  })
  .get("/avatar/*", async ({ params, set }: any) => {
    const key = params["*"];
    if (typeof key !== "string" || !/^avatars\/[a-z0-9_-]+\/[a-z0-9-]+\.(jpg|png|webp)$/.test(key)) {
      throw new ValidationError([{ field: "key", message: "Invalid avatar key" }]);
    }
    // Missing object → 404 (stale avatar_url in DB), not opaque 500.
    const bytes = await avatarStorage.download(key);
    set.headers["content-type"] = avatarContentType(key);
    set.headers["cache-control"] = "private, max-age=3600";
    return bytes;
  }, {
    detail: { summary: "Download profile avatar", tags: ["User"], security: [{ bearerAuth: [] }] },
  });
