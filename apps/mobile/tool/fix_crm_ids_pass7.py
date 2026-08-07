#!/usr/bin/env python3
"""Pass 7: safe mechanical fixes after CRM id migration."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORT = "import 'package:atlasmed_mobile_app/core/json/crm_id.dart';"

FACILITY_ID_MAP = {
    "facilityId: 'fac-orto'": "facilityId: 101",
    "facilityId: 'fac-cardio'": "facilityId: 102",
    "facilityId: 'fac-vitalis'": "facilityId: 103",
    "facilityId: 'fac-lucas'": "facilityId: 104",
    "facilityId: 'fac-primavera'": "facilityId: 105",
    "facilityId: 'fac-clara'": "facilityId: 106",
}

MOCK_ID_REGEX = [
    (r"\bid: 'prof-(\d+)'", r"id: \1"),
    (r"\bid: 'fp-(\d+)'", r"id: \1"),
    (r"\bid: 'nc-(\d+)'", r"id: \1"),
    (r"\bid: 'hp-(\d+)'", r"id: \1"),
    (r"\bid: 'hp-cat-(\d+)'", r"id: \1"),
    (r"\bid: 'ord-(\d+)'", r"id: \1"),
    (r"\bid: 'invite-(\d+)'", r"id: \1"),
    (r"\bid: 'grant-(\d+)'", r"id: \1"),
    (r"\bid: 'clinic-(\d+)'", r"id: \1"),
    (r"\bid: 'doc-(\d+)'", r"id: \1"),
    (r"\bid: 'prod-(\d+)'", r"id: \1"),
    (r"\bid: 'family-(\d+)'", r"id: \1"),
    (r"\bid: 'variant-(\d+)'", r"id: \1"),
    (r"\bid: 'def-(\d+)'", r"id: \1"),
    (r"\bid: 'sub-(\d+)'", r"id: \1"),
    (r"\bid: 'sug-(\d+)'", r"id: \1"),
    (r"\bid: 'note-(\d+)'", r"id: \1"),
    (r"\bid: 'visit-(\d+)'", r"id: \1"),
    (r"\bid: 'photo-(\d+)'", r"id: \1"),
    (r"\bid: 'rep-(\d+)'", r"id: \1"),
    (r"\bid: 'fac-(\w+)'", None),  # named fac-* handled separately
    (r"professionalId: 'prof-(\d+)'", r"professionalId: \1"),
    (r"facilityId: 'fac-(\d+)'", r"facilityId: \1"),
    (r"productId: 'prod-(\d+)'", r"productId: \1"),
    (r"orderId: 'ord-(\d+)'", r"orderId: \1"),
    (r"verticalId: 'sector-(\w+)'", None),
    (r"territoryId: 'territory-[^']+'", None),
    (r"managerTerritoryId: 'zone-[^']+'", None),
]

TERRITORY_TEST = {
    "TerritoryEditorTarget.existing('target')": "TerritoryEditorTarget.existing(1)",
    "TerritoryEditorTarget.existing('neighbor')": "TerritoryEditorTarget.existing(2)",
    "TerritoryEditorTarget.existing('legacy')": "TerritoryEditorTarget.existing(3)",
    "_territory(id: 'target'": "_territory(id: 1",
    "_territory(id: 'neighbor'": "_territory(id: 2",
    "id: 'legacy'": "id: 3",
    "id: 'created-${territories.length}'": "id: 100 + territories.length",
    "expect(repository.lastSavedId, 'target')": "expect(repository.lastSavedId, 1)",
    "expect(state.original?.id, 'target')": "expect(state.original?.id, 1)",
    "expect(state.neighbors.map((t) => t.id), ['neighbor'])": "expect(state.neighbors.map((t) => t.id), [2])",
    "containsAll(['target', 'neighbor'])": "containsAll([1, 2])",
}


def ensure_import(content: str) -> str:
    if IMPORT in content:
        return content
    if not any(
        s in content
        for s in ("isMockEmptyFacilityId", "isMockFacilityId", "isMockNearbyFacilityId")
    ):
        return content
    lines = content.splitlines(keepends=True)
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, IMPORT + "\n")
    return "".join(lines)


def process(content: str, path: Path) -> str:
    # Broken lambda from partial migration
    content = re.sub(r"\(f\) => f\.\(fileAssetId > 0\)", r"(f) => f.fileAssetId > 0", content)
    content = re.sub(
        r"f\.canView && f\.\(fileAssetId > 0\)",
        r"f.canView && f.fileAssetId > 0",
        content,
    )

    # facilityId fallback
    content = content.replace(
        "readCrmIdOrNull(item['facilityId'], 'facilityId') ?? readCrmIdOrNull(facility['id'], 'id') ?? ''",
        "readCrmIdOrNull(item['facilityId'], 'facilityId') ?? readCrmId(facility['id'], 'id')",
    )

    for old, new in FACILITY_ID_MAP.items():
        content = content.replace(old, new)

    if path.name == "territory_editor_controller_test.dart":
        for old, new in TERRITORY_TEST.items():
            content = content.replace(old, new)

    if path.name == "mock_users_repository.dart":
        content = content.replace(
            "Map<String, UserAssignments>", "Map<int, UserAssignments>"
        )
        content = content.replace(
            "Map<String, List<PermissionGrant>>", "Map<int, List<PermissionGrant>>"
        )
        content = content.replace(
            "id: managerId ?? 'mgr-$verticalId'",
            "id: managerId ?? verticalId * 1000",
        )

    for pattern, repl in MOCK_ID_REGEX:
        if repl:
            content = re.sub(pattern, repl, content)

    content = ensure_import(content)
    return content


def main() -> int:
    changed = 0
    for base in (ROOT / "lib", ROOT / "test"):
        for path in sorted(base.rglob("*.dart")):
            if path.name == "crm_id.dart":
                continue
            original = path.read_text()
            updated = process(original, path)
            if updated != original:
                path.write_text(updated)
                changed += 1
    result = subprocess.run(["dart", "analyze"], cwd=ROOT, capture_output=True, text=True)
    errors = sum(1 for line in result.stdout.splitlines() if "error -" in line)
    print(f"Pass7 changed {changed} files, errors: {errors}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
