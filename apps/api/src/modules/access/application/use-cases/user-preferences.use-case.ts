import {
  updateUserPreferencesSchema,
  userPreferencesSchema,
  userPreferencesShapeForReading,
  type UpdateUserPreferencesInput,
  type UserPreferencesInput,
} from "@atlasmed/access";
import { ValidationError } from "../../../../shared/errors";
import type { UserRepository } from "../interfaces/user.repository.interface";

interface UserPreferencesDependencies {
  userRepository: UserRepository;
}

/**
 * **Reading stored preferences must not fail on keys the code has forgotten.**
 *
 * The write schema is `.strict()`, which is right: a client sending a field
 * nobody defined should hear about it. Reading is the opposite situation — the
 * row was written by an older build, and refusing it helps nobody.
 *
 * Found on a device, not in a test: every rep whose preferences were saved
 * before §9 removed `lunchStart`/`lunchMinutes` still carries those keys, so
 * `GET /user/preferences` answered **500** for them. The screen that shows a
 * rep their own settings, dead, for the only reason that the app used to store
 * more than it does now.
 *
 * Unknown keys are dropped rather than kept: they are not part of the contract,
 * and echoing them back would let a removed field travel to clients that no
 * longer understand it.
 */
function parseMetadataPreferences(metadata: unknown): UserPreferencesInput {
  const preferences =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).preferences
      : undefined;

  const stored =
    preferences && typeof preferences === "object" && !Array.isArray(preferences)
      ? (preferences as Record<string, unknown>)
      : {};

  const known = new Set(Object.keys(userPreferencesShapeForReading.shape));
  const recognised = Object.fromEntries(
    Object.entries(stored).filter(([key]) => known.has(key)),
  );

  return userPreferencesSchema.parse(recognised);
}

function toValidationError(error: unknown): ValidationError {
  if (error && typeof error === "object" && "issues" in error) {
    const issues =
      (
        error as {
          issues?: Array<{ path: Array<string | number>; message: string }>;
        }
      ).issues ?? [];
    return new ValidationError(
      issues.map((issue) => ({
        field: issue.path.length ? `body.${issue.path.join(".")}` : "body",
        message: issue.message,
      })),
    );
  }

  return new ValidationError([
    { field: "body", message: "Invalid preferences" },
  ]);
}

export class GetUserPreferencesUseCase {
  constructor(private readonly deps: UserPreferencesDependencies) {}

  async execute(params: { userId: number }): Promise<UserPreferencesInput> {
    const metadata = await this.deps.userRepository.getMetadata(params.userId);
    return parseMetadataPreferences(metadata);
  }
}

export class UpdateUserPreferencesUseCase {
  constructor(private readonly deps: UserPreferencesDependencies) {}

  async execute(
    params: { userId: number } & UpdateUserPreferencesInput,
  ): Promise<UserPreferencesInput> {
    const { userId, ...patch } = params;
    const parsedPatch = updateUserPreferencesSchema.safeParse(patch);

    if (!parsedPatch.success) {
      throw toValidationError(parsedPatch.error);
    }

    if (Object.keys(parsedPatch.data).length === 0) {
      throw new ValidationError([
        {
          field: "body",
          message: "At least one preference field must be provided",
        },
      ]);
    }

    const metadata = await this.deps.userRepository.getMetadata(userId);
    const current = parseMetadataPreferences(metadata);
    const next = { ...current, ...parsedPatch.data };

    await this.deps.userRepository.updateMetadata(userId, {
      ...((metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {}) as Record<string, unknown>),
      preferences: next,
    });

    return next;
  }
}
