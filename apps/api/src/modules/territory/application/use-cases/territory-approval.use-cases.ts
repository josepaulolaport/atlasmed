import { Role } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryApprovalType } from "@atlasmed/database";
import type { TerritoryApprovalRepository } from "../interfaces/territory-approval.repository.interface";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import { TerritoryCrudUseCases } from "./territory-crud.use-cases";
import type { ClinicMembershipWriter } from "../services/territory-membership.service";
import type { IAuditLog } from "../../../access/application/interfaces/audit-log.interface";
import {
  OperationNotAllowedError,
  ResourceConflictError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { assertManagerTerritoryApprovalRequest } from "../services/territory-scope-policy.service";

interface Dependencies {
  approvalRepository: TerritoryApprovalRepository;
  territoryRepository: TerritoryRepository;
  closureRepository: TerritoryClosureRepository;
  territoryCrud: TerritoryCrudUseCases;
  clinicWriter: ClinicMembershipWriter;
  invalidateScopeForTerritories?: (territoryIds: string[]) => Promise<void>;
  enqueueMembershipRecompute?: (territoryId?: string) => Promise<void>;
  auditLog?: IAuditLog;
}

export class TerritoryApprovalUseCases {
  constructor(private readonly deps: Dependencies) {}

  async submitRequest(input: {
    requesterId: string;
    requesterRole: Role;
    scope: ScopeContext;
    type: TerritoryApprovalType;
    entityPayload: Record<string, unknown>;
    targetTerritoryId?: string;
    facilityId?: string;
    toTerritoryId?: string;
    reason?: string;
  }) {
    if (input.requesterRole !== Role.MANAGER) {
      throw new OperationNotAllowedError(
        "submit_approval",
        "Only managers submit territory approval requests"
      );
    }

    await assertManagerTerritoryApprovalRequest({
      scope: input.scope,
      territoryRepository: this.deps.territoryRepository,
      closureRepository: this.deps.closureRepository,
      type: input.type,
      targetTerritoryId: input.targetTerritoryId ?? null,
      facilityId: input.facilityId ?? null,
      toTerritoryId: input.toTerritoryId ?? null,
      entityPayload: input.entityPayload,
    });

    const pendingFromOthers = (
      await this.deps.approvalRepository.findPendingByEntity({
        type: input.type,
        targetTerritoryId: input.targetTerritoryId ?? null,
        facilityId: input.facilityId ?? null,
      })
    ).filter((request) => request.requesterId !== input.requesterId);

    if (pendingFromOthers.length > 0) {
      throw new ResourceConflictError(
        "TerritoryApprovalRequest",
        pendingFromOthers[0]!.id
      );
    }

    const ownPending = await this.deps.approvalRepository.findPendingByRequesterAndEntity({
      type: input.type,
      requesterId: input.requesterId,
      targetTerritoryId: input.targetTerritoryId ?? null,
      facilityId: input.facilityId ?? null,
    });

    const created = await this.deps.approvalRepository.create({
      type: input.type,
      requesterId: input.requesterId,
      entityPayload: input.entityPayload,
      targetTerritoryId: input.targetTerritoryId ?? null,
      facilityId: input.facilityId ?? null,
      toTerritoryId: input.toTerritoryId ?? null,
      reason: input.reason ?? null,
    });

    if (ownPending) {
      await this.deps.approvalRepository.supersede(ownPending.id, created.id);
    }

    return created;
  }

  async listRequests(input: { status?: "pending" | "approved" | "rejected" | "superseded"; page?: number; limit?: number }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    return this.deps.approvalRepository.list({
      status: input.status,
      page,
      limit,
    });
  }

  async approveRequest(input: { requestId: string; reviewerId: string; note?: string }) {
    const request = await this.deps.approvalRepository.findById(input.requestId);
    if (!request) {
      throw new ResourceNotFoundError("TerritoryApprovalRequest", input.requestId);
    }
    if (request.status !== "pending") {
      throw new OperationNotAllowedError(
        "approve_request",
        "Only pending requests can be approved"
      );
    }

    await this.applyApprovedRequest(request);

    const resolved = await this.deps.approvalRepository.resolve(input.requestId, {
      status: "approved",
      reviewerId: input.reviewerId,
      resolutionNote: input.note ?? null,
    });

    await this.deps.auditLog?.log({
      userId: input.reviewerId,
      eventType: "DATA_ACCESS",
      action: "approve_territory_request",
      resource: "territory_approval",
      resourceId: request.id,
      details: { type: request.type },
    });

    return resolved;
  }

  async rejectRequest(input: { requestId: string; reviewerId: string; note?: string }) {
    const request = await this.deps.approvalRepository.findById(input.requestId);
    if (!request) {
      throw new ResourceNotFoundError("TerritoryApprovalRequest", input.requestId);
    }
    if (request.status !== "pending") {
      throw new OperationNotAllowedError(
        "reject_request",
        "Only pending requests can be rejected"
      );
    }

    return this.deps.approvalRepository.resolve(input.requestId, {
      status: "rejected",
      reviewerId: input.reviewerId,
      resolutionNote: input.note ?? null,
    });
  }

  private async applyApprovedRequest(request: {
    type: TerritoryApprovalType;
    entityPayload: Record<string, unknown>;
    targetTerritoryId: string | null;
    facilityId: string | null;
    toTerritoryId: string | null;
  }): Promise<void> {
    switch (request.type) {
      case "create_territory":
        await this.deps.territoryCrud.createTerritory({
          name: String(request.entityPayload.name),
          slug: String(request.entityPayload.slug),
          territoryTypeId: request.entityPayload.territoryTypeId as string | undefined,
          typeSlug: request.entityPayload.typeSlug as string | undefined,
          countryCode: request.entityPayload.countryCode as string | undefined,
          parentId: request.entityPayload.parentId as string | undefined,
          boundary: request.entityPayload.boundary as
            | { type: "Polygon" | "MultiPolygon"; coordinates: unknown }
            | undefined,
        });
        break;
      case "reparent_territory":
        if (!request.targetTerritoryId) {
          throw new OperationNotAllowedError(
            "approve_request",
            "Missing target territory for reparent request"
          );
        }
        await this.deps.territoryCrud.updateTerritory(request.targetTerritoryId, {
          parentId: request.entityPayload.parentId as string | null,
          name: request.entityPayload.name as string | undefined,
        });
        await this.deps.enqueueMembershipRecompute?.(request.targetTerritoryId);
        await this.deps.invalidateScopeForTerritories?.([request.targetTerritoryId]);
        break;
      case "deactivate_territory":
        if (!request.targetTerritoryId) {
          throw new OperationNotAllowedError(
            "approve_request",
            "Missing target territory for deactivate request"
          );
        }
        await this.deps.territoryCrud.deactivateTerritory(request.targetTerritoryId);
        await this.deps.invalidateScopeForTerritories?.([request.targetTerritoryId]);
        break;
      case "facility_territory_change":
        if (!request.facilityId || !request.toTerritoryId) {
          throw new OperationNotAllowedError(
            "approve_request",
            "Missing clinic or target territory for clinic move request"
          );
        }
        const target = await this.deps.territoryRepository.findById(request.toTerritoryId);
        if (!target?.isActive) {
          throw new OperationNotAllowedError(
            "approve_request",
            "Target territory must be active"
          );
        }
        await this.deps.clinicWriter.updateTerritoryMembership(request.facilityId, {
          territoryId: request.toTerritoryId,
          territoryAssignmentStatus: "assigned",
          territoryAssignmentSource: "manual",
        });
        await this.deps.invalidateScopeForTerritories?.([request.toTerritoryId]);
        break;
      default:
        throw new OperationNotAllowedError("approve_request", "Unknown approval type");
    }
  }
}
