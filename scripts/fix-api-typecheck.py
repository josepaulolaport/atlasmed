#!/usr/bin/env python3
"""Targeted CRM id type fixes for apps/api typecheck pass."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "apps/api/src"

# CRM entity map keys that should be number, not string
MAP_KEY_FIXES = [
    (r"Map<string, FacilityVerticalProfileRecord\[\]>", "Map<number, FacilityVerticalProfileRecord[]>"),
    (r"Map<string, ConsultantInfo>", "Map<number, ConsultantInfo>"),
    (r"Map<string, string \| null>", "Map<number, string | null>"),  # zone manager names - careful
    (r"Map<string, Date>", "Map<number, Date>"),
    (r"Map<string, FacilityService\[\]>", "Map<number, FacilityService[]>"),
    (r"Map<string, number>", "Map<number, number>"),
    (r"Map<string, ProfessionalFacilityAssociation\[\]>", "Map<number, ProfessionalFacilityAssociation[]>"),
    (r"Map<string, string\[\]>", "Map<number, string[]>"),  # product verticalIds - vertical ids are numbers
    (r"Map<string, InviteStagedVerticalAssignment\[\]>", "Map<number, InviteStagedVerticalAssignment[]>"),
    (r"new Map<string, string\[\]>\(\)", "new Map<number, string[]>()"),
    (r"new Map<string, number>\(\)", "new Map<number, number>()"),
    (r"new Map<string, FacilityService\[\]>\(\)", "new Map<number, FacilityService[]>()"),
    (r"const territoriesByKey = new Map<string, string\[\]>\(\)", "const territoriesByKey = new Map<string, number[]>()"),
    (r"const seenTerritoryIds = new Set<string>\(\)", "const seenTerritoryIds = new Set<number>()"),
    (r"Promise<Map<string, FacilityVerticalProfileRecord\[\]>>", "Promise<Map<number, FacilityVerticalProfileRecord[]>>"),
    (r"Promise<Map<string, number>>", "Promise<Map<number, number>>"),
]

# inArray empty-scope sentinel
NONE_SENTINEL = [
    (r'\["__none__"\]', "[-1]"),
    (r"eqFilter\(\"id\", \"__none__\"\)", 'eqFilter("id", -1)'),
    (r'eqFilter\("activeFacilityIds", "__none__"\)', 'eqFilter("activeFacilityIds", -1)'),
    (r'eqFilter\("activeFacilityIds", \'__none__\'\)', 'eqFilter("activeFacilityIds", -1)'),
]

# Test fixture string literals -> numbers
FIXTURE_REPLACEMENTS = [
    (r'"user-123"', "123"),
    (r'"user-1"', "1"),
    (r'"user-2"', "2"),
    (r'"user-3"', "3"),
    (r'"role-123"', "1"),
    (r'"role-1"', "1"),
    (r'"role-2"', "2"),
    (r'"session-123"', "1"),
    (r'"session-1"', "1"),
    (r'"facility-1"', "1"),
    (r'"facility-2"', "2"),
    (r'"territory-1"', "1"),
    (r'"territory-2"', "2"),
    (r'"vertical-1"', "1"),
    (r'"vertical-2"', "2"),
    (r'"invite-1"', "1"),
    (r'"professional-1"', "1"),
    (r'"professional-2"', "2"),
    (r'"product-1"', "1"),
    (r'"order-1"', "1"),
    (r'"manager-1"', "1"),
    (r'"grantedBy": "user-1"', '"grantedBy": 1'),
    (r'"grantedBy": "admin-1"', '"grantedBy": 1'),
    (r'"revokedBy": "user-1"', '"revokedBy": 1'),
    (r'"invitedByUserId": "user-1"', '"invitedByUserId": 1'),
    (r'"invitedByUserId": "admin-1"', '"invitedByUserId": 1'),
    (r'invitedByUserId: "user-1"', "invitedByUserId: 1"),
    (r'invitedByUserId: "admin-1"', "invitedByUserId: 1"),
    (r'grantedBy: "user-1"', "grantedBy: 1"),
    (r'grantedBy: "admin-1"', "grantedBy: 1"),
    (r'revokedBy: "user-1"', "revokedBy: 1"),
    (r'userId: "user-1"', "userId: 1"),
    (r'userId: "user-2"', "userId: 2"),
    (r'actorId: "user-1"', "actorId: 1"),
    (r'targetUserId: "user-1"', "targetUserId: 1"),
    (r'facilityId: "facility-1"', "facilityId: 1"),
    (r'territoryId: "territory-1"', "territoryId: 1"),
    (r'verticalId: "vertical-1"', "verticalId: 1"),
    (r'roleId: "role-1"', "roleId: 1"),
    (r'sessionId: "session-1"', "sessionId: 1"),
    (r'inviteId: "invite-1"', "inviteId: 1"),
    (r'professionalId: "professional-1"', "professionalId: 1"),
    (r'managerTerritoryId: "territory-1"', "managerTerritoryId: 1"),
    (r'repTerritoryId: "territory-1"', "repTerritoryId: 1"),
    (r'territoryIds: \["territory-1"\]', "territoryIds: [1]"),
    (r'territoryIds: \["territory-1", "territory-2"\]', "territoryIds: [1, 2]"),
    (r'facilityIds: \["facility-1"\]', "facilityIds: [1]"),
    (r'facilityIds: \["facility-1", "facility-2"\]', "facilityIds: [1, 2]"),
    (r'facilityIds: \["__none__"\]', "facilityIds: [-1]"),
    (r'verticalIds: \["vertical-1"\]', "verticalIds: [1]"),
    (r'\["territory-1", "territory-2"\]', "[1, 2]"),
    (r'\["facility-1", "facility-2"\]', "[1, 2]"),
]

GRANTED_BY_FIX = [
    (r"grantedBy: string", "grantedBy: number"),
    (r"revokedBy: string", "revokedBy: number"),
]


def fix_file(path: Path) -> bool:
    content = path.read_text()
    original = content
    rel = str(path.relative_to(ROOT))

    for pat, sub in GRANTED_BY_FIX:
        content = re.sub(pat, sub, content)

    for pat, sub in NONE_SENTINEL:
        content = re.sub(pat, sub, content)

    # deriveProfileTerritoryId fix
    if path.name == "drizzle-facility.repository.ts":
        content = content.replace(
            "): string | null {",
            "): number | null {",
            1,
        )
        content = content.replace(
            '.filter((id): id is string => typeof id === "string" && id.length > 0)',
            '.filter((id): id is number => typeof id === "number" && id > 0)',
        )
        content = content.replace(
            "Array<string | null | undefined>",
            "Array<number | null | undefined>",
        )
        content = content.replace(
            '(id): id is string => typeof id === "string" && id.length > 0',
            '(id): id is number => typeof id === "number" && id > 0',
        )
        content = content.replace(
            """) as Array<{
    facility_id: string;""",
            """) as Array<{
    facility_id: number;""",
        )

    for pat, sub in MAP_KEY_FIXES:
        content = re.sub(pat, sub, content)

    if ".test." in path.name or "fixture" in path.name or "mock" in path.name:
        for pat, sub in FIXTURE_REPLACEMENTS:
            content = re.sub(pat, sub, content)

    if content != original:
        path.write_text(content)
        return True
    return False


def main() -> None:
    changed = 0
    for path in sorted(API.rglob("*.ts")):
        if fix_file(path):
            changed += 1
            print(f"fixed {path.relative_to(ROOT)}")
    print(f"Updated {changed} files")


if __name__ == "__main__":
    main()
