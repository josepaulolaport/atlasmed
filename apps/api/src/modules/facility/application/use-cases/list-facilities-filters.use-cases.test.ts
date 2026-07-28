import { Role } from "@atlasmed/access";
import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ListFacilitiesUseCase } from "./facility.use-cases";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";

describe("ListFacilitiesUseCase filters", () => {
  it("passes geo, commercial status, and product filters to the scoped repository and serializes distance", async () => {
    const repository = {
      findAll: mock(async () => ({
        facilities: [{
          id: "facility-1", name: "Nearby",
          neighborhood: null, city: null, state: null,
          streetAddress: null, streetNumber: null, addressComplement: null, postalCode: null,
          phone: null, whatsapp: null, email: null, website: null, billingEmail: null,
          responsibleName: null, openingHours: null,
          taxIdType: "PJ", cnpj: null, cpf: null,
          lat: -23.55, lng: -46.63, territoryId: null, territoryName: null, territoryAssignmentStatus: "unassigned",
          territoryAssignmentSource: "geo",
          commercialStatus: null, purchaseStatus: null, conformityStatus: "INCOMPLETE",
          sourceProvider: null,
          externalSourceId: null, sourceContentHash: null, sourceFirstSeenAt: null,
          sourceLastSeenAt: null, sourcePresent: false, sourceTracked: false, manuallyEditedAt: null,
          deactivatedAt: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
          services: [], professionalCount: 0, consultantName: null, consultantSince: null, managerName: null, imageUrl: null, distanceKm: 1.25,
        }], total: 1,
      })),
    } as unknown as FacilityRepository;

    const result = await new ListFacilitiesUseCase({ facilityRepository: repository }).execute({
      userId: "user-1",
      page: 2, limit: 10, latitude: -23.55, longitude: -46.63, radiusKm: 5,
      commercialStatus: "REGISTERED", productIds: ["product-a", "product-b"],
      purchaseFunnelStages: ["PURCHASE_WINDOW", "CHURN"], purchaseProfile: "AUTOMATIC",
      purchaseIntervalMinDays: 15, purchaseIntervalMaxDays: 90,
      sort: "purchaseFunnelStage", order: "desc",
      role: Role.ADMIN,
      scope: { isGlobal: false, facilityIds: ["facility-1"] } as ScopeContext,
    });

    expect(repository.findAll).toHaveBeenCalledWith(expect.objectContaining({
      page: 2, limit: 10, latitude: -23.55, longitude: -46.63, radiusKm: 5,
      commercialStatus: "REGISTERED", productIds: ["product-a", "product-b"], sort: "purchaseFunnelStage", order: "desc",
      purchaseFunnelStages: ["PURCHASE_WINDOW", "CHURN"], purchaseProfile: "AUTOMATIC",
      purchaseIntervalMinDays: 15, purchaseIntervalMaxDays: 90,
      userId: "user-1",
      scope: {
        isGlobal: false, facilityIds: ["facility-1"],
        restrictToVerticalProfiles: true, verticalIds: [],
      },
    }));
    expect(result.data[0]?.distanceKm).toBe(1.25);
    expect(result.pagination).toMatchObject({ page: 2, limit: 10, total: 1 });
  });
});
