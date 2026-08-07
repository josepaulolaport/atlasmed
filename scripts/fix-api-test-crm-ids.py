#!/usr/bin/env python3
"""Bulk-fix CRM numeric ids and JWT string claims in apps/api test files."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_SRC = ROOT / "apps/api/src"

LITERAL_REPLACEMENTS = [
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
    (r'"grant-1"', "1"),
    (r'"professional-1"', "1"),
    (r'"order-1"', "1"),
    (r'"visit-1"', "1"),
    (r'"rep-1"', "1"),
    (r'"manager-1"', "1"),
    (r'"admin-1"', "1"),
    (r'"product-1"', "1"),
    (r'"product-2"', "2"),
    (r'"v1"', "1"),
    (r'"v2"', "2"),
    (r'"v3"', "3"),
]

CRM_ID_FIELD = (
    r"(?P<field>"
    r"userId|roleId|facilityId|territoryId|verticalId|professionalId|sessionId|"
    r"inviteId|grantId|productId|orderId|visitId|managerId|targetTerritoryId|"
    r"toTerritoryId|territoryTypeId|reviewerId|requesterId|actorId|assignedByUserId|"
    r"confirmedByUserId|invitedByUserId|recordId|requirementId|sellerId|"
    r"competitorProductId|unsuspendedBy|revokedBy|createdByUserId|updatedByUserId|"
    r"submittedByUserId|fileAssetId|uploadSessionId|submissionId|documentId|"
    r"facilityProfessionalId|consultantUserId|ownerId|parentId|categoryId|"
    r"brandId|supplierId|warehouseId|clinicId|doctorId|patientId|"
    r"\bid\b"
    r")"
)

NUMERIC_STRING_FIELD = re.compile(
    rf"{CRM_ID_FIELD}:\s*\"(?P<val>\d+)\"",
)

NUMERIC_STRING_FIELD_OPT = re.compile(
    rf"{CRM_ID_FIELD}\?:\s*\"(?P<val>\d+)\"",
)

JWT_NUMERIC = re.compile(
    r"(?P<field>sub|sid):\s*(?P<val>\d+)(?P<trail>[,}\n])",
)

ARRAY_NUMERIC_STRINGS = re.compile(
    r"(?P<field>"
    r"assignedVerticalIds|assignedTerritoryIds|effectiveTerritoryIds|"
    r"analyticsEffectiveTerritoryIds|territoryIds|facilityIds|"
    r"analyticsFacilityIds|clinicIds|analyticsClinicIds|managedUserIds|"
    r"reportAssignedTerritoryIds|oversightZoneIds|grantIds|revokedSessionIds|"
    r"professionalIds|userIds|verticalIds|excludeIds|candidateIds|ids|"
    r"flaggedFileAssetIds|productIds"
    r"):\s*\[(?P<items>[^\]]*)\]",
)


def quote_numeric_jwt(content: str) -> str:
    def repl(m: re.Match[str]) -> str:
        return f'{m.group("field")}: "{m.group("val")}"{m.group("trail")}'

    return JWT_NUMERIC.sub(repl, content)


def unquote_numeric_crm_fields(content: str) -> str:
    content = NUMERIC_STRING_FIELD.sub(
        lambda m: f'{m.group("field")}: {m.group("val")}', content
    )
    return NUMERIC_STRING_FIELD_OPT.sub(
        lambda m: f'{m.group("field")}?: {m.group("val")}', content
    )


def fix_numeric_id_arrays(content: str) -> str:
    def repl(m: re.Match[str]) -> str:
        items = m.group("items")
        fixed_items = re.sub(r'"(\d+)"', r"\1", items)
        return f'{m.group("field")}: [{fixed_items}]'

    return ARRAY_NUMERIC_STRINGS.sub(repl, content)


def is_test_file(path: Path) -> bool:
    name = path.name
    return name.endswith(".test.ts") or name.endswith(".integration.test.ts")


def process_file(path: Path) -> bool:
    original = path.read_text()
    updated = original
    for pat, sub in LITERAL_REPLACEMENTS:
        updated = re.sub(pat, sub, updated)
    updated = quote_numeric_jwt(updated)
    updated = unquote_numeric_crm_fields(updated)
    updated = fix_numeric_id_arrays(updated)
    updated = re.sub(r'\.toBe\("(\d+)"\)', r".toBe(\1)", updated)
    updated = re.sub(r'===\s*"(\d+)"', r"=== \1", updated)
    updated = re.sub(r'!==\s*"(\d+)"', r"!== \1", updated)
    if updated != original:
        path.write_text(updated)
        return True
    return False


def main() -> int:
    changed = 0
    for path in sorted(API_SRC.rglob("*.ts")):
        if not is_test_file(path):
            continue
        if process_file(path):
            changed += 1
    print(f"Updated {changed} test files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
