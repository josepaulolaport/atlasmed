import type { CreateUserParams } from "../modules/access/application/interfaces/user.repository.interface";
import { getUniqueTestId } from "./database-helpers";

/**
 * Generate unique user parameters for testing
 * Ensures no conflicts between parallel or sequential tests
 */
export function createTestUserParams(roleId: string, overrides?: Partial<CreateUserParams>): CreateUserParams {
  const uniqueId = getUniqueTestId();
  
  return {
    email: `user_${uniqueId}@example.com`,
    username: `user_${uniqueId}`,
    passwordHash: "$argon2id$test",
    roleId,
    ...overrides,
  };
}
