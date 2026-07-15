import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/.turbo/**",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [tseslint.configs.base],
    rules: {},
  }
);
