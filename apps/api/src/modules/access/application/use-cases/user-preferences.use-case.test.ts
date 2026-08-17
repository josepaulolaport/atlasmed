import { describe, expect, test } from "bun:test";
import {
  GetUserPreferencesUseCase,
  UpdateUserPreferencesUseCase,
} from "./user-preferences.use-case";

/** Only the two methods these use cases touch. */
function repositoryWith(metadata: unknown) {
  const saved: Array<Record<string, unknown>> = [];
  return {
    saved,
    userRepository: {
      getMetadata: async () => metadata,
      updateMetadata: async (_id: number, next: Record<string, unknown>) => {
        saved.push(next);
      },
    } as never,
  };
}

/** What a rep's row looks like after §9 removed the lunch preferences. */
const withRemovedLunchKeys = {
  preferences: {
    theme: "system",
    lunchStart: null,
    workdayEnd: null,
    lunchMinutes: null,
    workdayStart: null,
    smsNotificationsEnabled: false,
    pushNotificationsEnabled: true,
    emailNotificationsEnabled: true,
  },
};

describe("GetUserPreferencesUseCase", () => {
  test("reads a row written before a preference was removed", async () => {
    // Found on a device, not here: every rep whose preferences were saved
    // before §9 dropped `lunchStart`/`lunchMinutes` still carries those keys,
    // and the read schema is `.strict()` — so the screen that shows a rep their
    // own settings answered 500, for the sole reason that the app used to store
    // more than it does now.
    const { userRepository } = repositoryWith(withRemovedLunchKeys);

    const result = await new GetUserPreferencesUseCase({
      userRepository,
    }).execute({ userId: 2 });

    expect(result.theme).toBe("system");
    expect(result.workdayEnd).toBeNull();
    // Dropped rather than echoed: a removed field must not travel back out to
    // clients that no longer understand it.
    expect(result).not.toHaveProperty("lunchStart");
    expect(result).not.toHaveProperty("lunchMinutes");
  });

  test("still refuses an unknown key a client tries to write", async () => {
    // Tolerant on read, strict on write. The row is history; the request is a
    // contract, and a client sending a field nobody defined should hear so.
    const { userRepository } = repositoryWith(withRemovedLunchKeys);

    await expect(
      new UpdateUserPreferencesUseCase({ userRepository }).execute({
        userId: 2,
        lunchStart: "12:00",
      } as never),
    ).rejects.toThrow();
  });

  test("a patch over a legacy row saves without the dead keys", async () => {
    const { userRepository, saved } = repositoryWith(withRemovedLunchKeys);

    await new UpdateUserPreferencesUseCase({ userRepository }).execute({
      userId: 2,
      workdayEnd: "17:00",
    });

    const preferences = saved[0]?.preferences as Record<string, unknown>;
    expect(preferences.workdayEnd).toBe("17:00");
    expect(preferences).not.toHaveProperty("lunchStart");
  });
});
