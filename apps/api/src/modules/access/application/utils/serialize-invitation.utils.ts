import type { InviteRecord } from "../interfaces/invite.repository.interface";
import type { InviteStagedSectorAssignment } from "../interfaces/invite.repository.interface";

export function serializeInvitation(params: {
  invite: InviteRecord;
  invitedBy?: {
    id: string;
    username: string;
    email: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  sectorAssignments?: Array<{
    sectorId: string;
    sectorName?: string;
    managerId?: string | null;
    managerName?: string;
    territories: Array<{
      id: string;
      name: string;
      sectorId?: string;
      sectorName?: string;
      boundary?: unknown;
    }>;
  }>;
}) {
  const { invite, invitedBy, sectorAssignments = [] } = params;
  const invitedByName = invitedBy
    ? [invitedBy.firstName, invitedBy.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || invitedBy.username
    : "Unknown";

  const firstSector = sectorAssignments[0];

  return {
    id: invite.id,
    email: invite.email ?? undefined,
    phoneNumber: invite.phoneNumber ?? undefined,
    firstName: invite.firstName ?? undefined,
    lastName: invite.lastName ?? undefined,
    birthDate: invite.birthDate
      ? invite.birthDate.toISOString().slice(0, 10)
      : undefined,
    status: invite.status,
    roleId: invite.role.id,
    roleName: invite.role.name,
    role: {
      id: invite.role.id,
      name: invite.role.name,
    },
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? undefined,
    revokedAt: invite.revokedAt?.toISOString() ?? undefined,
    resendCount: invite.resendCount,
    invitedByName,
    invitedBy: invitedBy
      ? {
          id: invitedBy.id,
          username: invitedBy.username,
          email: invitedBy.email ?? "",
          firstName: invitedBy.firstName ?? undefined,
          lastName: invitedBy.lastName ?? undefined,
        }
      : {
          id: invite.invitedByUserId,
          username: "Unknown",
          email: "",
        },
    managerName: firstSector?.managerName,
    territoryName: firstSector?.territories.map((t) => t.name).join(", "),
    sectorAssignments,
  };
}

export function groupStagedAssignments(
  rows: InviteStagedSectorAssignment[],
): Map<string, InviteStagedSectorAssignment[]> {
  const map = new Map<string, InviteStagedSectorAssignment[]>();
  for (const row of rows) {
    const list = map.get(row.invitationId) ?? [];
    list.push(row);
    map.set(row.invitationId, list);
  }
  return map;
}
