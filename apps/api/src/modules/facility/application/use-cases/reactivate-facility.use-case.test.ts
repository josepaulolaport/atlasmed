import { describe, expect, mock, test } from "bun:test";
import { ReactivateFacilityUseCase } from "./facility.use-cases";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";

/**
 * Putting a deactivated clinic back (spec 0016 §4.8).
 *
 * The blocker check is the part worth testing. A CNPJ is unique only among
 * *active* clinics, so another may have taken this one's number while it was
 * away; reactivating then trips the index. The point of checking first is to
 * answer with a sentence instead of a constraint violation, which only works if
 * the check actually finds the holder.
 */

function repository(
  overrides: Partial<Record<keyof FacilityRepository, unknown>> = {}
) {
  return {
    findByIdIncludingDeactivated: mock(() =>
      Promise.resolve({
        id: 7,
        name: "Clínica Central",
        legalDocument: "55044648000151",
        legalDocumentType: "CNPJ" as const,
        deactivatedAt: new Date("2026-01-01"),
      })
    ),
    findActiveCnpjHolder: mock(() => Promise.resolve(null)),
    // `serializeFacility` reads dates off the record, so the stub has to be a
    // plausible one rather than just an id.
    reactivate: mock(() =>
      Promise.resolve({
        id: 7,
        name: "Clínica Central",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2026-01-01"),
        verticalProfiles: [],
        clinicalFocuses: [],
      } as never)
    ),
    ...overrides,
  } as unknown as FacilityRepository;
}

describe("ReactivateFacilityUseCase", () => {
  test("clears the flag and puts the clinic back in the search index", async () => {
    const facilityRepository = repository();
    const onFacilityChanged = mock(() => Promise.resolve());

    await new ReactivateFacilityUseCase({
      facilityRepository,
      onFacilityChanged,
    } as never).execute({ facilityId: 7 });

    expect(facilityRepository.reactivate).toHaveBeenCalledWith(7);
    // The document was deleted on deactivation; without this the clinic is live
    // in the database and invisible in Explorar.
    expect(onFacilityChanged).toHaveBeenCalledWith(7);
  });

  test("refuses when another active clinic holds the CNPJ", async () => {
    // The regression this exists for: the first implementation searched the
    // deactivated list for its own row and read the blocker off it, which found
    // nothing whenever another deactivated clinic sorted ahead. The check
    // passed, the index rejected the write, and the admin got a generic
    // conflict instead of the sentence naming the problem.
    const facilityRepository = repository({
      findActiveCnpjHolder: mock(() => Promise.resolve(99)),
    });

    await expect(
      new ReactivateFacilityUseCase({ facilityRepository } as never).execute({
        facilityId: 7,
      })
    ).rejects.toThrow(/CNPJ/);
    expect(facilityRepository.reactivate).not.toHaveBeenCalled();
  });

  test("asks only about this clinic's own document", async () => {
    const facilityRepository = repository();

    await new ReactivateFacilityUseCase({ facilityRepository } as never).execute(
      { facilityId: 7 }
    );

    expect(facilityRepository.findActiveCnpjHolder).toHaveBeenCalledWith({
      legalDocument: "55044648000151",
      excludeFacilityId: 7,
    });
  });

  test("a CPF clinic is never blocked", async () => {
    // Only CNPJ is unique among active rows; CPF clinics may share a number.
    const facilityRepository = repository({
      findByIdIncludingDeactivated: mock(() =>
        Promise.resolve({
          id: 7,
          name: "Consultório",
          legalDocument: "12345678901",
          legalDocumentType: "CPF" as const,
          deactivatedAt: new Date("2026-01-01"),
        })
      ),
    });

    await new ReactivateFacilityUseCase({ facilityRepository } as never).execute(
      { facilityId: 7 }
    );

    expect(facilityRepository.findActiveCnpjHolder).not.toHaveBeenCalled();
    expect(facilityRepository.reactivate).toHaveBeenCalled();
  });

  test("refuses a clinic that is already active", async () => {
    const facilityRepository = repository({
      findByIdIncludingDeactivated: mock(() =>
        Promise.resolve({
          id: 7,
          name: "Clínica Central",
          legalDocument: null,
          legalDocumentType: null,
          deactivatedAt: null,
        })
      ),
    });

    await expect(
      new ReactivateFacilityUseCase({ facilityRepository } as never).execute({
        facilityId: 7,
      })
    ).rejects.toThrow(/já está ativa/);
    expect(facilityRepository.reactivate).not.toHaveBeenCalled();
  });

  test("404s on a clinic that does not exist", async () => {
    const facilityRepository = repository({
      findByIdIncludingDeactivated: mock(() => Promise.resolve(null)),
    });

    await expect(
      new ReactivateFacilityUseCase({ facilityRepository } as never).execute({
        facilityId: 7,
      })
    ).rejects.toThrow();
  });
});
