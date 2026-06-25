"use client";

import { Label } from "@/components/ui/label";
import type { TerritoryTypeFlags } from "@/types/territory";

const FLAG_FIELDS: Array<{
  key: keyof TerritoryTypeFlags;
  label: string;
  description: string;
}> = [
  {
    key: "canHaveBoundary",
    label: "Can have boundary",
    description: "Territories of this type support polygon boundaries.",
  },
  {
    key: "assignsClinics",
    label: "Assigns clinics",
    description: "Clinics inside the boundary are assigned to this territory.",
  },
  {
    key: "assignableToUsers",
    label: "Assignable to users",
    description: "Field reps can be assigned to territories of this type.",
  },
  {
    key: "assignableToManagers",
    label: "Assignable to managers",
    description: "Managers can be assigned to territories of this type.",
  },
  {
    key: "isCountryLevel",
    label: "Country level",
    description: "Top-level country territory; cannot have a parent.",
  },
  {
    key: "blockSiblingOverlap",
    label: "Block sibling overlap",
    description: "Reject boundaries that overlap siblings of the same type.",
  },
];

interface TerritoryTypeFlagsFieldsProps {
  flags: TerritoryTypeFlags;
  onChange: (flags: TerritoryTypeFlags) => void;
  disabled?: boolean;
  idPrefix?: string;
}

export function TerritoryTypeFlagsFields({
  flags,
  onChange,
  disabled = false,
  idPrefix = "type-flag",
}: TerritoryTypeFlagsFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FLAG_FIELDS.map((field) => (
        <label
          key={field.key}
          htmlFor={`${idPrefix}-${field.key}`}
          className="flex cursor-pointer items-start gap-2 rounded-md border p-3"
        >
          <input
            id={`${idPrefix}-${field.key}`}
            type="checkbox"
            className="mt-1"
            checked={Boolean(flags[field.key])}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...flags,
                [field.key]: e.target.checked,
              })
            }
          />
          <span>
            <span className="block text-sm font-medium text-gray-900">{field.label}</span>
            <span className="block text-xs text-gray-500">{field.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export const DEFAULT_TERRITORY_TYPE_FLAGS: TerritoryTypeFlags = {
  canHaveBoundary: true,
  assignsClinics: false,
  assignableToUsers: false,
  assignableToManagers: false,
  isCountryLevel: false,
  blockSiblingOverlap: false,
};
