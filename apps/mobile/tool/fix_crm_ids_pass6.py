#!/usr/bin/env python3
"""Pass 6: targeted fixes for remaining CRM id migration analyzer errors."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORT = "import 'package:atlasmed_mobile_app/core/json/crm_id.dart';"

FACILITY_LITERAL_MAP = {
    "'fac-orto'": "101",
    "'fac-cardio'": "102",
    "'fac-vitalis'": "103",
    "'fac-lucas'": "104",
    "'fac-primavera'": "105",
    "'fac-clara'": "106",
}

TERRITORY_TEST_MAP = {
    "'target'": "1",
    "'neighbor'": "2",
    "'legacy'": "3",
    "TerritoryEditorTarget.existing('target')": "TerritoryEditorTarget.existing(1)",
    "TerritoryEditorTarget.existing('neighbor')": "TerritoryEditorTarget.existing(2)",
    "TerritoryEditorTarget.existing('legacy')": "TerritoryEditorTarget.existing(3)",
    "id: 'created-${territories.length}'": "id: 100 + territories.length",
    "expect(repository.lastSavedId, 'target')": "expect(repository.lastSavedId, 1)",
    "expect(state.original?.id, 'target')": "expect(state.original?.id, 1)",
    "expect(state.neighbors.map((t) => t.id), ['neighbor'])": "expect(state.neighbors.map((t) => t.id), [2])",
    "containsAll(['target', 'neighbor'])": "containsAll([1, 2])",
    "_territory(id: 'target'": "_territory(id: 1",
    "_territory(id: 'neighbor'": "_territory(id: 2",
    "id: 'legacy'": "id: 3",
    "slug: 'legacy'": "slug: 'legacy-slug'",
    "code: 'legacy'": "code: 'legacy-code'",
}

REPLACEMENTS = [
    (r"\(f\) => f\.\(fileAssetId > 0\)", r"(f) => f.fileAssetId > 0"),
    (r"f\.canView && f\.\(fileAssetId > 0\)", r"f.canView && f.fileAssetId > 0"),
    (
        r"readCrmIdOrNull\(item\['facilityId'\], 'facilityId'\) \?\? readCrmIdOrNull\(facility\['id'\], 'id'\) \?\? ''",
        r"readCrmIdOrNull(item['facilityId'], 'facilityId') ?? readCrmId(item['facilityId'] ?? facility['id'], 'facilityId')",
    ),
    (r"Map<String, UserAssignments>", r"Map<int, UserAssignments>"),
    (r"Map<String, List<PermissionGrant>>", r"Map<int, List<PermissionGrant>>"),
    (r"id: managerId \?\? 'mgr-\$verticalId'", r"id: managerId ?? verticalId * 1000"),
    (r"final Map<String,", r"final Map<int,"),
    (r"Map<String, String>", r"Map<int, int>"),
    (r"Set<String> _selected", r"Set<int> _selected"),
    (r"Set<String> selected", r"Set<int> selected"),
    (r"List<String> territoryIds", r"List<int> territoryIds"),
    (r"String\? _selectedVerticalId", r"int? _selectedVerticalId"),
    (r"String\? selectedVerticalId", r"int? selectedVerticalId"),
    (r"DropdownButton<String>", r"DropdownButton<int>"),
    (r"DropdownButtonFormField<String>", r"DropdownButtonFormField<int>"),
    (r"StateProvider<String?>", r"StateProvider<int?>"),
    (r"ProviderListenable<String?>", r"ProviderListenable<int?>"),
    (r"String\? _editingId", r"int? _editingId"),
    (r"String\? editingId", r"int? editingId"),
    (r"String\? _familyId", r"int? _familyId"),
    (r"String\? familyId", r"int? familyId"),
    (r"String _productId", r"int _productId"),
    (r"final String productId", r"final int productId"),
    (r"final String facilityId", r"final int facilityId"),
    (r"final String\? facilityId", r"final int? facilityId"),
    (r"required String facilityId", r"required int facilityId"),
    (r"required String productId", r"required int productId"),
    (r"required String orderId", r"required int orderId"),
    (r"required String territoryId", r"required int territoryId"),
    (r"required String userId", r"required int userId"),
    (r"required String id", r"required int id"),
    (r"String\? _selectedId", r"int? _selectedId"),
    (r"String get id", r"int get id"),
    (r"return type of 'String\?'", r"return type of 'int?'"),  # noop safety
    (r"_familyIdForName", r"_familyIdForName"),  # keep
    (r"String\? _familyIdForName", r"int? _familyIdForName"),
    (r"String\? familyIdForName", r"int? familyIdForName"),
    (r"List<Object>", r"List<int>"),
    (r"Set<Object>", r"Set<int>"),
    (r"Map<Object,", r"Map<int,"),
    (r"FutureProvider\.family<([^,]+), String>", r"FutureProvider.family<\1, int>"),
    (r"Provider\.family<([^,]+), String>", r"Provider.family<\1, int>"),
    (r"AutoDisposeProvider\.family<([^,]+), String>", r"AutoDisposeProvider.family<\1, int>"),
    (r"NotifierProvider\.family<([^,]+), ([^,]+), String>", r"NotifierProvider.family<\1, \2, int>"),
    (r"AutoDisposeNotifierProvider\.family<([^,]+), ([^,]+), String>", r"AutoDisposeNotifierProvider.family<\1, \2, int>"),
    (r"\.family<([^>]+), String>", r".family<\1, int>"),
    (r"parseInt\(", r"parseRouteCrmId("),
    (r"int\.parse\(", r"parseRouteCrmId("),
]


def ensure_import(content: str, symbols: list[str]) -> str:
    needed = [s for s in symbols if s in content]
    if not needed or IMPORT in content:
        return content
    lines = content.splitlines(keepends=True)
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, IMPORT + "\n")
    return "".join(lines)


def process_file(path: Path) -> bool:
    original = path.read_text()
    updated = original

    for old, new in FACILITY_LITERAL_MAP.items():
        updated = updated.replace(old, new)

    if path.name == "territory_editor_controller_test.dart":
        for old, new in TERRITORY_TEST_MAP.items():
            updated = updated.replace(old, new)

    for pattern, repl in REPLACEMENTS:
        updated = re.sub(pattern, repl, updated)

    if "isMockEmptyFacilityId" in updated or "isMockFacilityId" in updated:
        updated = ensure_import(updated, ["isMockEmptyFacilityId", "isMockFacilityId"])

    if updated != original:
        path.write_text(updated)
        return True
    return False


def main() -> int:
    changed = 0
    for base in (ROOT / "lib", ROOT / "test"):
        for path in sorted(base.rglob("*.dart")):
            if path.name == "crm_id.dart":
                continue
            if process_file(path):
                changed += 1
                print(f"  {path.relative_to(ROOT)}")

    result = subprocess.run(["dart", "analyze"], cwd=ROOT, capture_output=True, text=True)
    errors = sum(1 for line in result.stdout.splitlines() if "error -" in line)
    print(f"Pass6 changed {changed} files, errors: {errors}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
