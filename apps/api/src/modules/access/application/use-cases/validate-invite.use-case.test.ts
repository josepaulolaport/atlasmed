import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ValidateInviteUseCase } from "./validate-invite.use-case";
import { InvalidInviteError } from "../../../../shared/errors";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import { createMockInviteRepository } from "../../test-helpers/fixtures";

describe("ValidateInviteUseCase", () => {
  let useCase: ValidateInviteUseCase;
  let mockInviteRepository: InviteRepository;

  beforeEach(() => {
    mockInviteRepository = createMockInviteRepository({
      findValidByTokenHash: mock(async () => ({
        email: "invited@example.com",
        phoneNumber: null,
        expiresAt: new Date(Date.now() + 60_000),
        role: { id: "role-1", name: "USER" },
      })),
    });

    useCase = new ValidateInviteUseCase({
      inviteRepository: mockInviteRepository,
    });
  });

  it("returns invite metadata for a valid token", async () => {
    const result = await useCase.execute({ token: "valid-token" });

    expect(result.email).toBe("invited@example.com");
    expect(result.role.name).toBe("USER");
    expect(result.expiresAt).toBeString();
  });

  it("throws InvalidInviteError when token is missing", async () => {
    await expect(useCase.execute({ token: "   " })).rejects.toThrow(InvalidInviteError);
  });

  it("throws InvalidInviteError when invite is not found", async () => {
    mockInviteRepository.findValidByTokenHash = mock(async () => null);

    await expect(useCase.execute({ token: "missing-token" })).rejects.toThrow(
      InvalidInviteError
    );
  });
});
