import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ListProfessionalsUseCase } from "./professional.use-cases";
import type { ProfessionalRepository } from "../interfaces/professional.repository.interface";

describe("ListProfessionalsUseCase filters", () => {
  it("passes specialty and geo filters to the repository and serializes distance", async () => {
    const repository = {
      findAll: mock(async () => ({
        professionals: [{
          id: 1, firstName: "Ana", lastName: "Silva", fullName: "Ana Silva",
          socialName: null, taxId: null, birthDate: null, mobilePhone: null, landlinePhone: null,
          email: null, websiteUrl: null, imageUrl: null, favoriteTeam: null, favoriteSport: null,
          languages: null, hobbies: null, specialty: "Cardiology", crmCouncil: null, crmNumber: null,
          crmState: null,
          facilityIds: [1], createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"), deletedAt: null, distanceKm: 2.5,
        }], total: 1,
      })),
    } as unknown as ProfessionalRepository;

    const result = await new ListProfessionalsUseCase({ doctorRepository: repository }).execute({
      latitude: -23.55, longitude: -46.63, radiusKm: 10, specialty: "Cardiology",
      scope: { isGlobal: false, facilityIds: [1] } as ScopeContext,
    });

    expect(repository.findAll).toHaveBeenCalledWith(expect.objectContaining({
      latitude: -23.55, longitude: -46.63, radiusKm: 10, specialty: "Cardiology",
      scope: { isGlobal: false, facilityIds: [1] },
    }));
    expect(result.data[0]?.distanceKm).toBe(2.5);
    expect(result.pagination.total).toBe(1);
  });
});
