import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/build/**"] },
  ...tseslint.configs.recommended,
  {
    // Existing codebase has many any types and unused vars; keep as warnings
    // so they're visible but don't block pushes or CI.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  }
);
