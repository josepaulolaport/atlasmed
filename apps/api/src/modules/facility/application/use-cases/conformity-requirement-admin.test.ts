import { describe, expect, it, mock } from "bun:test";
import {
  CreateConformityRequirementUseCase,
  DeleteConformityRequirementUseCase,
  ListConformityRequirementsUseCase,
  UpdateConformityRequirementUseCase,
} from "./conformity.use-cases";
import type {
  ConformityRepository,
  ConformityRequirementRecord,
} from "../interfaces/conformity.repository.interface";
import { ResourceInUseError, ValidationError } from "../../../../shared/errors";

/**
 * The cadastro catalogue's admin writes (spec 0016 §4.7).
 *
 * This is the widest-reaching write in the panel — an active requirement is
 * immediately missing from every clinic in scope — so the rules that bound it
 * are asserted rather than left to the form.
 */
const requirement: ConformityRequirementRecord = {
  id: 1,
  slug: "licenca_sanitaria",
  name: "Licença Sanitária",
  description: null,
  verticalId: null,
  appliesToLegalDocumentType: null,
  isActive: true,
  allowedMimeTypes: ["application/pdf"],
  maxFiles: 4,
  maxFileSizeBytes: 10_485_760,
  maxCombinedSizeBytes: 41_943_040,
  requiresFrontAndBack: false,
  requiresValidityDate: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

function repository(overrides: Partial<ConformityRepository> = {}): ConformityRepository {
  return {
    findActiveRequirements: mock(() => Promise.resolve([requirement])),
    findAllRequirements: mock(() => Promise.resolve([requirement])),
    findRequirementById: mock(() => Promise.resolve(requirement)),
    createRequirement: mock(() => Promise.resolve(requirement)),
    updateRequirement: mock(() => Promise.resolve(requirement)),
    deleteRequirementIfUnanswered: mock(),
    ...overrides,
  } as unknown as ConformityRepository;
}

describe("conformity requirement admin writes", () => {
  it("derives a slug from the name when none is given", async () => {
    const conformityRepository = repository();

    await new CreateConformityRequirementUseCase({ conformityRepository }).execute({
      name: "  Licença Sanitária  ",
    });

    expect(conformityRepository.createRequirement).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "licenca_sanitaria", name: "Licença Sanitária" })
    );
  });

  it("fills the column defaults so a short form is a complete one", async () => {
    const conformityRepository = repository();

    await new CreateConformityRequirementUseCase({ conformityRepository }).execute({
      name: "Cartão CNPJ",
    });

    expect(conformityRepository.createRequirement).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
        maxFiles: 10,
        requiresValidityDate: false,
        // Null scope = every Linha, every clinic. The widest reach, and the
        // default, which is why the client confirms before activating.
        verticalId: null,
        appliesToLegalDocumentType: null,
      })
    );
  });

  it("refuses a requirement that accepts no file type", async () => {
    // Otherwise the rep is asked for a document they cannot possibly send.
    const conformityRepository = repository();

    await expect(
      new CreateConformityRequirementUseCase({ conformityRepository }).execute({
        name: "Impossível",
        allowedMimeTypes: [],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(conformityRepository.createRequirement).not.toHaveBeenCalled();
  });

  it("never changes the slug on update", async () => {
    // It is the key every cadastro DTO travels under, so renaming it would
    // orphan anything that had learned it. `name` is the label to change.
    const conformityRepository = repository();

    await new UpdateConformityRequirementUseCase({ conformityRepository }).execute({
      id: 1,
      name: "Licença Sanitária Municipal",
    });

    const patch = (conformityRepository.updateRequirement as ReturnType<typeof mock>).mock
      .calls[0]![1] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("slug");
    expect(patch).toEqual({ name: "Licença Sanitária Municipal" });
  });

  it("refuses to delete a requirement a clinic has answered", async () => {
    // Both foreign keys are RESTRICT, so the alternative is a bare 23503.
    const conformityRepository = repository({
      deleteRequirementIfUnanswered: mock(() =>
        Promise.resolve({
          found: true as const,
          deleted: false as const,
          references: { conformityRecords: 12 },
        })
      ),
    });

    const failure = await new DeleteConformityRequirementUseCase({ conformityRepository })
      .execute({ id: 1 })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ResourceInUseError);
    expect((failure as ResourceInUseError).toClientJSON()).toMatchObject({
      code: "RESOURCE_IN_USE",
      blockedBy: { conformityRecords: 12 },
    });
  });

  it("reads the checklist and the admin catalogue from different sources", async () => {
    /*
     * A retired requirement must never reach a clinic's checklist — it would
     * ask a rep for a document nobody wants — but the admin list has to show it
     * or nobody could reactivate it. Two questions, two reads.
     */
    const conformityRepository = repository();

    const checklist = await new ListConformityRequirementsUseCase({
      conformityRepository,
    }).execute();
    const adminList = await new ListConformityRequirementsUseCase({
      conformityRepository,
    }).execute({ includeInactive: true });

    expect(conformityRepository.findActiveRequirements).toHaveBeenCalled();
    expect(conformityRepository.findAllRequirements).toHaveBeenCalled();
    // Only the admin shape carries what the admin form edits.
    expect(checklist.data[0]).not.toHaveProperty("maxFiles");
    expect(adminList.data[0]).toMatchObject({
      maxFiles: 4,
      requiresValidityDate: true,
      allowedMimeTypes: ["application/pdf"],
    });
  });
});
