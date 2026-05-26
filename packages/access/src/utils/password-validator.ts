export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENT_MESSAGES = [
  "At least 8 characters",
  "Contains uppercase letters",
  "Contains lowercase letters",
  "Contains numbers",
] as const;

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(PASSWORD_REQUIREMENT_MESSAGES[0]);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push(PASSWORD_REQUIREMENT_MESSAGES[1]);
  }

  if (!/[a-z]/.test(password)) {
    errors.push(PASSWORD_REQUIREMENT_MESSAGES[2]);
  }

  if (!/[0-9]/.test(password)) {
    errors.push(PASSWORD_REQUIREMENT_MESSAGES[3]);
  }

  return { valid: errors.length === 0, errors: [...errors] };
}
