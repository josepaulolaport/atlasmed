import type { Territory, TerritoryType } from "@/types/territory";

export type AssignableRole = "USER" | "MANAGER";

export interface TerritoryAssignmentPickerConfig {
  filterAssignableToUsers?: boolean;
  filterAssignableToManagers?: boolean;
  excludeCountry?: boolean;
  helperText: string;
}

export function getTerritoryAssignmentPickerConfig(
  role: AssignableRole
): TerritoryAssignmentPickerConfig {
  if (role === "USER") {
    return {
      filterAssignableToUsers: true,
      helperText:
        "Field reps are assigned to territories whose type allows clinic assignment.",
    };
  }

  return {
    filterAssignableToManagers: true,
    excludeCountry: true,
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
    return type.assignableToManagers && !type.isCountryLevel;
  }

  return type.assignableToUsers;
}

export function territoryMatchesPickerFilters(
  territory: Territory,
  config: TerritoryAssignmentPickerConfig
): boolean {
  const type = territory.territoryType;
  if (!territory.isActive) return false;
  if (config.excludeCountry && type.isCountryLevel) return false;
  if (config.filterAssignableToUsers && !type.assignableToUsers) return false;
  if (config.filterAssignableToManagers && !type.assignableToManagers) return false;
  return true;
}

export function formatTerritoryLabel(t: Pick<Territory, "code" | "name" | "slug" | "territoryType" | "countryCode" | "isCountryLevel">): string {
  const market = t.countryCode ? ` · ${t.countryCode}` : "";
  if (t.isCountryLevel) {
    return `${t.name}${market}`;
  }
  return `${t.name} (${t.slug})${market}`;
}

export type { TerritoryType };
