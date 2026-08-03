import { describe, expect, it } from "bun:test";
import { registerSchema } from "./validators";

describe("registerSchema", () => {
  it("keeps the identity confirmation required by the registration API", () => {
    const result = registerSchema.parse({
      token: "ABC12345",
      email: "pessoa@example.com",
      username: "pessoa",
      password: "Password123!",
      firstName: "Pessoa",
      lastName: "Silva",
      birthDate: "1990-05-12",
    });

    expect(result).toMatchObject({
      firstName: "Pessoa",
      lastName: "Silva",
      birthDate: "1990-05-12",
    });
  });

  it("rejects registration without birth date", () => {
    const result = registerSchema.safeParse({
      token: "ABC12345",
      email: "pessoa@example.com",
      username: "pessoa",
      password: "Password123!",
      firstName: "Pessoa",
      lastName: "Silva",
    });

    expect(result.success).toBe(false);
  });
});
