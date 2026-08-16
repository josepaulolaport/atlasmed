import { describe, expect, it } from "bun:test";
import { ExplainRejectionUseCase, RejectStopUseCase } from "./reject-stop.use-case";
import type {
  RoteiroRejectionReason,
  RoteiroRepository,
} from "../interfaces/roteiro.repository.interface";

class FakeRepository {
  rows: {
    id: number;
    userId: number;
    facilityVerticalProfileId: number;
    reason: RoteiroRejectionReason | null;
  }[] = [];

  async recordRejection(input: { userId: number; facilityVerticalProfileId: number }) {
    const priorCount = this.rows.filter(
      (r) =>
        r.userId === input.userId &&
        r.facilityVerticalProfileId === input.facilityVerticalProfileId,
    ).length;
    const id = this.rows.length + 1;
    this.rows.push({ ...input, id, reason: null });
    return { id, priorCount };
  }

  async setRejectionReason(input: {
    rejectionId: number;
    userId: number;
    reason: RoteiroRejectionReason;
  }) {
    const row = this.rows.find((r) => r.id === input.rejectionId && r.userId === input.userId);
    if (row) row.reason = input.reason;
  }
}

const repo = () => new FakeRepository() as unknown as RoteiroRepository & FakeRepository;

describe("RejectStopUseCase", () => {
  it("does not ask why the first time — one removal is a shrug", async () => {
    // The same tap means "not here" and "not today", and a rep dropping a good
    // clinic because Monday is a bad drive is telling us about their calendar.
    const repository = repo();
    const useCase = new RejectStopUseCase({ repository });

    const result = await useCase.execute({
      actor: { userId: 7 },
      verticalId: 1,
      facilityVerticalProfileId: 42,
    });

    expect(result.shouldAskReason).toBe(false);
  });

  it("asks why the second time, when the question is earned", async () => {
    const repository = repo();
    const useCase = new RejectStopUseCase({ repository });

    await useCase.execute({ actor: { userId: 7 }, verticalId: 1, facilityVerticalProfileId: 42 });
    const second = await useCase.execute({
      actor: { userId: 7 },
      verticalId: 1,
      facilityVerticalProfileId: 42,
    });

    expect(second.shouldAskReason).toBe(true);
  });

  it("counts per rep and per clinic, not globally", async () => {
    // One rep's "not my client" is another rep's account, and a rep who has
    // never turned this clinic down should not be interrogated about it.
    const repository = repo();
    const useCase = new RejectStopUseCase({ repository });

    await useCase.execute({ actor: { userId: 7 }, verticalId: 1, facilityVerticalProfileId: 42 });
    const otherRep = await useCase.execute({
      actor: { userId: 8 },
      verticalId: 1,
      facilityVerticalProfileId: 42,
    });
    const otherClinic = await useCase.execute({
      actor: { userId: 7 },
      verticalId: 1,
      facilityVerticalProfileId: 43,
    });

    expect(otherRep.shouldAskReason).toBe(false);
    expect(otherClinic.shouldAskReason).toBe(false);
  });

  it("refuses to let a manager reject on a rep's behalf", async () => {
    // A manager may draft a rep's day. "I do not want this clinic" is not
    // theirs to say.
    const repository = repo();
    const useCase = new RejectStopUseCase({ repository });

    await expect(
      useCase.execute({
        actor: { userId: 9 },
        subjectUserId: 7,
        verticalId: 1,
        facilityVerticalProfileId: 42,
      }),
    ).rejects.toThrow();
  });
});

describe("ExplainRejectionUseCase", () => {
  it("attaches the reason to the rep's own rejection", async () => {
    const repository = repo();
    const rejected = await new RejectStopUseCase({ repository }).execute({
      actor: { userId: 7 },
      verticalId: 1,
      facilityVerticalProfileId: 42,
    });

    await new ExplainRejectionUseCase({ repository }).execute({
      actor: { userId: 7 },
      rejectionId: rejected.rejectionId,
      reason: "SEM_INTERESSE",
    });

    expect(repository.rows[0]?.reason).toBe("SEM_INTERESSE");
  });

  it("does not let anyone else put words in the rep's mouth", async () => {
    const repository = repo();
    const rejected = await new RejectStopUseCase({ repository }).execute({
      actor: { userId: 7 },
      verticalId: 1,
      facilityVerticalProfileId: 42,
    });

    await new ExplainRejectionUseCase({ repository }).execute({
      actor: { userId: 9 },
      rejectionId: rejected.rejectionId,
      reason: "FECHADA",
    });

    // FECHADA removes the clinic for every rep, so a stray write here would
    // delete a clinic from somebody else's book on a stranger's say-so.
    expect(repository.rows[0]?.reason).toBeNull();
  });
});
