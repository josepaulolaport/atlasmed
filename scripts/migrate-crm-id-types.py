#!/usr/bin/env python3
"""Bulk-update CRM FK/PK TypeScript types from string to number."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TARGET_DIRS = [
    ROOT / "packages/access/src",
    ROOT / "apps/api/src",
]

# Fields that must remain string (CASL resource keys, natural keys, tokens).
KEEP_STRING_SUFFIXES = {
    "resourceId",
    "cnesCode",
    "serviceCode",
    "classificationCode",
    "tokenHash",
    "refreshTokenHash",
    "previousRefreshTokenHash",
    "identifier",
    "managerZoneId",  # slug-like territory zone key in invitations
}

# Array fields holding CRM numeric ids.
CRM_ID_ARRAY_FIELDS = {
    "assignedTerritoryIds",
    "assignedVerticalIds",
    "effectiveTerritoryIds",
    "analyticsEffectiveTerritoryIds",
    "territoryIds",
    "facilityIds",
    "analyticsFacilityIds",
    "clinicIds",
    "analyticsClinicIds",
    "managedUserIds",
    "reportAssignedTerritoryIds",
    "oversightZoneIds",
    "grantIds",
    "revokedSessionIds",
    "facilityIds",
    "professionalIds",
    "userIds",
    "verticalIds",
    "territoryIds",
    "excludeIds",
}

# Standalone `id` stays string in these path fragments.
ID_STRING_PATH_HINTS = (
    "access-token",
    "token.service",
    "generate-random-token",
    "hash-token",
    "invite-code",
)

# Mock fixture string literals -> numbers
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
    (r'"invite-1"', "1"),
    (r'"grant-1"', "1"),
    (r'"professional-1"', "1"),
    (r'"order-1"', "1"),
    (r'"visit-1"', "1"),
]


def should_keep_id_string(path: Path) -> bool:
    s = str(path).lower()
    return any(h in s for h in ID_STRING_PATH_HINTS)


def replace_field_types(content: str, path: Path) -> str:
    def repl_id_field(match: re.Match[str]) -> str:
        field = match.group(1)
        if field in KEEP_STRING_SUFFIXES:
            return match.group(0)
        if field.endswith("Id") or field.endswith("ID"):
            if field in KEEP_STRING_SUFFIXES:
                return match.group(0)
            return match.group(0).replace(": string", ": number").replace("?: string", "?: number")

    # *Id fields
    patterns = [
        (r"(\b\w+Id)\?: string \| null", r"\1?: number | null"),
        (r"(\b\w+Id): string \| null", r"\1: number | null"),
        (r"(\b\w+Id)\?: string", r"\1?: number"),
        (r"(\b\w+Id): string", r"\1: number"),
        (r"(\b\w+Id): string\[\]", r"\1: number[]"),
        (r"(\b\w+Id)\?: string\[\]", r"\1?: number[]"),
        (r"(\b\w+Ids): string\[\]", r"\1: number[]"),
        (r"(\b\w+Ids)\?: string\[\]", r"\1?: number[]"),
        (r"Array<string>", "Array<number>"),  # conservative; may over-replace
    ]

    for field in CRM_ID_ARRAY_FIELDS:
        patterns.append((rf"(\b{field}): string\[\]", r"\1: number[]"))
        patterns.append((rf"(\b{field})\?: string\[\]", r"\1?: number[]"))
        patterns.append((rf"(\b{field})\?: \(string\[\]\)", r"\1?: (number[])"))

    for pat, sub in patterns:
        def _sub(m: re.Match[str], _sub=sub, _pat=pat):
            field = m.group(1) if m.lastindex else ""
            if field in KEEP_STRING_SUFFIXES:
                return m.group(0)
            return re.sub(_pat, _sub, m.group(0))

        content = re.sub(pat, lambda m, p=pat, s=sub: (
            m.group(0)
            if (m.lastindex and m.group(1) in KEEP_STRING_SUFFIXES)
            else re.sub(p, s, m.group(0), count=1)
        ), content)

    # Method params: (fooId: string) and (id: string) in repo methods
    content = re.sub(
        r"\((\w+Id): string\)",
        lambda m: f"({m.group(1)}: number)" if m.group(1) not in KEEP_STRING_SUFFIXES else m.group(0),
        content,
    )
    content = re.sub(
        r"\((\w+Id): string,",
        lambda m: f"({m.group(1)}: number," if m.group(1) not in KEEP_STRING_SUFFIXES else m.group(0),
        content,
    )
    content = re.sub(
        r", (\w+Id): string\)",
        lambda m: f", {m.group(1)}: number)" if m.group(1) not in KEEP_STRING_SUFFIXES else m.group(0),
        content,
    )
    content = re.sub(
        r", (\w+Id): string,",
        lambda m: f", {m.group(1)}: number," if m.group(1) not in KEEP_STRING_SUFFIXES else m.group(0),
        content,
    )
    content = re.sub(
        r"\(id: string\)",
        "(id: number)" if not should_keep_id_string(path) else "(id: string)",
        content,
    )
    content = re.sub(
        r"\bid: string\b",
        lambda m: "id: number" if not should_keep_id_string(path) else m.group(0),
        content,
    )
    content = re.sub(
        r"\bid\?: string\b",
        lambda m: "id?: number" if not should_keep_id_string(path) else m.group(0),
        content,
    )

    # zod schemas for CRM ids
    zod_replacements = [
        (r"(\b\w+Id): z\.string\(\)\.min\(1\)", r"\1: z.coerce.number().int().positive()"),
        (r"(\b\w+Id): z\.string\(\)\.trim\(\)\.min\(1\)", r"\1: z.coerce.number().int().positive()"),
        (r"(\b\w+Ids): z\.array\(z\.string\(\)\.min\(1\)\)", r"\1: z.array(z.coerce.number().int().positive())"),
        (r"(\b\w+Ids): z\.array\(z\.string\(\)\.trim\(\)\.min\(1\)\)", r"\1: z.array(z.coerce.number().int().positive())"),
        (r"verticalId: z\.string\(\)\.min\(1\)", "verticalId: z.coerce.number().int().positive()"),
        (r"facilityId: z\.string\(\)\.trim\(\)\.min\(1\)", "facilityId: z.coerce.number().int().positive()"),
        (r"territoryId: z\.string\(\)\.trim\(\)\.min\(1\)", "territoryId: z.coerce.number().int().positive()"),
        (r"roleId: z\.string\(\)", "roleId: z.coerce.number().int().positive()"),
        (r"roleId: z\.string\(\)\.min\(1\)", "roleId: z.coerce.number().int().positive()"),
        (r"managerId: z\.string\(\)\.min\(1\)", "managerId: z.coerce.number().int().positive()"),
        (r"targetTerritoryId: z\.string\(\)\.trim\(\)\.min\(1\)", "targetTerritoryId: z.coerce.number().int().positive()"),
        (r"toTerritoryId: z\.string\(\)\.trim\(\)\.min\(1\)", "toTerritoryId: z.coerce.number().int().positive()"),
        (r"territoryTypeId: z\.string\(\)\.trim\(\)\.min\(1\)", "territoryTypeId: z.coerce.number().int().positive()"),
    ]
    for pat, sub in zod_replacements:
        def zsub(m: re.Match[str], p=pat, s=sub):
            field = m.group(1) if m.lastindex else ""
            if field in KEEP_STRING_SUFFIXES:
                return m.group(0)
            return re.sub(p, s, m.group(0), count=1)
        content = re.sub(pat, zsub, content)

    # Test fixtures
    if "test" in path.name or "fixture" in path.name or "mock" in path.name:
        for pat, sub in FIXTURE_REPLACEMENTS:
            content = re.sub(pat, sub, content)

    return content


def process_file(path: Path) -> bool:
    original = path.read_text()
    updated = replace_field_types(original, path)
    if updated != original:
        path.write_text(updated)
        return True
    return False


def main() -> int:
    changed = 0
    for base in TARGET_DIRS:
        for path in sorted(base.rglob("*.ts")):
            if process_file(path):
                changed += 1
                print(path.relative_to(ROOT))
    print(f"\nUpdated {changed} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
