/**
 * Utilities for resetting mocks between tests
 * This helps prevent test interference
 */

/**
 * Reset all mock functions on an object
 */
export function resetMocks(obj: Record<string, any>) {
  Object.values(obj).forEach((value) => {
    if (typeof value === "function" && "mock" in value) {
      value.mockClear?.();
      value.mockReset?.();
    }
  });
}

/**
 * Reset multiple mock objects
 */
export function resetAllMocks(...mocks: Record<string, any>[]) {
  mocks.forEach(resetMocks);
}
