import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UpdateAvatarUseCase } from "./update-avatar.use-case";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import { createMockAuthCache, createMockUserRepository, createMockUserWithRole } from "../../test-helpers/fixtures";

describe("UpdateAvatarUseCase", () => {
  const user = createMockUserWithRole();
  let repository: UserRepository;
  let authCache: IAuthCache;
  let storage: { upload: ReturnType<typeof mock>; delete: ReturnType<typeof mock> };
  let useCase: UpdateAvatarUseCase;

  beforeEach(() => {
    repository = createMockUserRepository({
      findById: mock(async () => user),
      updateProfile: mock(async (_id, data) => ({ ...user, avatarUrl: data.avatarUrl ?? null })),
    });
    authCache = createMockAuthCache();
    storage = { upload: mock(async () => undefined), delete: mock(async () => undefined) };
    useCase = new UpdateAvatarUseCase({ userRepository: repository, authCache, storage });
  });

  it("stores a validated image and persists its stable avatar URL", async () => {
    const result = await useCase.upload({
      userId: user.id,
      file: new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" }),
    });

    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^avatars\/user-123\/[a-z0-9-]+\.png$/),
      expect.any(Uint8Array),
      "image/png",
    );
    expect(repository.updateProfile).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ avatarUrl: expect.stringContaining("/api/v1/user/avatar/") }),
    );
    expect(result.avatarUrl).toContain("/api/v1/user/avatar/");
    expect(authCache.invalidate).toHaveBeenCalledWith(user.id);
  });

  it("rejects an unsupported content type without writing", async () => {
    await expect(useCase.upload({
      userId: user.id,
      file: new File([new Uint8Array([1])], "avatar.gif", { type: "image/gif" }),
    })).rejects.toThrow("Request validation failed");

    expect(storage.upload).not.toHaveBeenCalled();
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it("removes the stored object and clears the avatar URL", async () => {
    const avatarUser = { ...user, avatarUrl: "/api/v1/user/avatar/avatars/user-123/current.png" };
    repository.findById = mock(async () => avatarUser);
    repository.updateProfile = mock(async (_id, data) => ({ ...avatarUser, avatarUrl: data.avatarUrl ?? null }));

    const result = await useCase.remove({ userId: user.id });

    expect(storage.delete).toHaveBeenCalledWith("avatars/user-123/current.png");
    expect(repository.updateProfile).toHaveBeenCalledWith(user.id, { avatarUrl: null, avatarBlurhash: null });
    expect(result.avatarUrl).toBeNull();
  });
});
