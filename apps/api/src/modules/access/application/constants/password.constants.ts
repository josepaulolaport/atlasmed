export const PASSWORD_HISTORY_LIMIT = 5;

/** Used for constant-time login when the user does not exist. */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$MnWOOrL1UUNgwERrllk3cg$UaTiYGcWj30ZB7HikbrNnRpS71OEitxcaWvIkLF5fIA";

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS = [
  "At least 8 characters",
  "Contains uppercase letters",
  "Contains lowercase letters",
  "Contains numbers",
] as const;
