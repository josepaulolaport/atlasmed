import type { InviteRecord } from "../interfaces/invite.repository.interface";
import type { InviteStagedVerticalAssignment } from "../interfaces/invite.repository.interface";

export function serializeInvitation(params: {
  invite: InviteRecord;
  invitedBy?: {
    id: string;
    username: string;
    email: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  verticalAssignments?: Array<{
    verticalId: string;
    verticalName?: string;
    managerId?: string | null;
    managerName?: string;
    territories: Array<{
      id: string;
      name: string;
      verticalId?: string;
      verticalName?: string;
      boundary?: unknown;
    }>;
  }>;
}) {
  const { invite, invitedBy, verticalAssignments = [] } = params;
  const invitedByName = invitedBy
    ? [invitedBy.firstName, invitedBy.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || invitedBy.username
    : "Unknown";

  const firstVertical = verticalAssignments[0];

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
    managerName: firstVertical?.managerName,
    territoryName: firstVertical?.territories.map((t) => t.name).join(", "),
    verticalAssignments,
  };
}

export function groupStagedAssignments(
  rows: InviteStagedVerticalAssignment[],
): Map<string, InviteStagedVerticalAssignment[]> {
  const map = new Map<string, InviteStagedVerticalAssignment[]>();
  for (const row of rows) {
    const list = map.get(row.invitationId) ?? [];
    list.push(row);
    map.set(row.invitationId, list);
  }
  return map;
}
