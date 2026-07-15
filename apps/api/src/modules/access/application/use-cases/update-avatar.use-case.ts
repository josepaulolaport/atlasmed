import { randomUUID } from "node:crypto";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { UserRepository, UserRecord } from "../interfaces/user.repository.interface";
import { UserNotFoundError, ValidationError } from "../../../../shared/errors";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface AvatarStoragePort {
  upload(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface UpdateAvatarDependencies {
  userRepository: UserRepository;
  authCache: IAuthCache;
  storage: AvatarStoragePort;
}

interface UploadAvatarInput {
  userId: string;
  file: File;
}

interface RemoveAvatarInput {
  userId: string;
}

export class UpdateAvatarUseCase {
  constructor(private readonly dependencies: UpdateAvatarDependencies) {}

  async upload(input: UploadAvatarInput): Promise<UserRecord> {
    const user = await this.findUser(input.userId);
    const extension = imageExtensions[input.file.type];

    if (!extension) {
      throw new ValidationError([{ field: "avatar", message: "Avatar must be a JPEG, PNG, or WebP image" }]);
    }

    if (input.file.size === 0 || input.file.size > MAX_AVATAR_BYTES) {
      throw new ValidationError([{ field: "avatar", message: "Avatar must be between 1 byte and 5 MB" }]);
    }

    const key = `avatars/${input.userId}/${randomUUID()}.${extension}`;
    await this.dependencies.storage.upload(key, new Uint8Array(await input.file.arrayBuffer()), input.file.type);

    const updatedUser = await this.dependencies.userRepository.updateProfile(input.userId, {
      avatarUrl: this.avatarUrl(key),
    });

    await this.deletePreviousAvatar(user.avatarUrl, key);
    await this.dependencies.authCache.invalidate(input.userId);
    return updatedUser;
  }

  async remove(input: RemoveAvatarInput): Promise<UserRecord> {
    const user = await this.findUser(input.userId);
    const updatedUser = await this.dependencies.userRepository.updateProfile(input.userId, { avatarUrl: null });
    await this.deletePreviousAvatar(user.avatarUrl);
    await this.dependencies.authCache.invalidate(input.userId);
    return updatedUser;
  }

  private async findUser(userId: string): Promise<UserRecord> {
    const user = await this.dependencies.userRepository.findById(userId);
    if (!user) throw new UserNotFoundError(userId);
    return user;
  }

  private avatarUrl(key: string): string {
    return `/api/v1/user/avatar/${key}`;
  }

  private async deletePreviousAvatar(avatarUrl: string | null | undefined, replacementKey?: string): Promise<void> {
    const key = this.keyFromAvatarUrl(avatarUrl);
    if (key && key !== replacementKey) await this.dependencies.storage.delete(key);
  }

  private keyFromAvatarUrl(avatarUrl: string | null | undefined): string | null {
    if (!avatarUrl) return null;
    const prefix = "/api/v1/user/avatar/";
    const key = avatarUrl.startsWith(prefix) ? avatarUrl.slice(prefix.length) : null;
    return key && /^avatars\/[a-z0-9_-]+\/[a-z0-9-]+\.(jpg|png|webp)$/.test(key) ? key : null;
  }
}
