import type { Territory, TerritoryType } from "@/types/territory";

export type AssignableRole = "REP" | "MANAGER";

export interface TerritoryAssignmentPickerConfig {
  filterAssignableToUsers?: boolean;
  filterAssignableToManagers?: boolean;
  helperText: string;
}

export function getTerritoryAssignmentPickerConfig(
  role: AssignableRole
): TerritoryAssignmentPickerConfig {
  if (role === "REP") {
    return {
      filterAssignableToUsers: true,
      helperText:
        "Field reps are assigned to territories whose type allows clinic assignment.",
    };
  }

  return {
    filterAssignableToManagers: true,
    helperText:
      "Managers are assigned to territory types configured for manager oversight.",
  };
}

export function canAssignUserToTerritoryNode(input: {
  userRole: AssignableRole;
  territory: Pick<Territory, "territoryType">;
}): boolean {
  const type = input.territory.territoryType;

  if (input.userRole === "MANAGER") {
    return type.assignableToManagers;
  }

  return type.assignableToUsers;
}

export function territoryMatchesPickerFilters(
  territory: Territory,
  config: TerritoryAssignmentPickerConfig
): boolean {
  const type = territory.territoryType;
  if (!territory.isActive) return false;
  if (config.filterAssignableToUsers && !type.assignableToUsers) return false;
  if (config.filterAssignableToManagers && !type.assignableToManagers) return false;
  return true;
}

export function formatTerritoryLabel(t: Pick<Territory, "code" | "name" | "slug">): string {
  return `${t.name} (${t.slug})`;
}

export type { TerritoryType };
