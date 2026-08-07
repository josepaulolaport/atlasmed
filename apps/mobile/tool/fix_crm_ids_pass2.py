#!/usr/bin/env python3
"""Second pass: fix remaining CRM id migration issues in apps/mobile."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "lib"
TEST = ROOT / "test"

# Global string-literal -> int for mock/seed data.
LITERAL_MAP = {
    "'sector-oncologia'": "1",
    "'sector-cardiologia'": "2",
    "'tt-manager-zone'": "1",
    "'tt-patch'": "2",
    "'user-fernanda-duarte'": "101",
    "'user-marcos-lima'": "102",
    "'user-bruno-castro'": "103",
    "'user-camila-rocha'": "104",
    "'user-diego-farias'": "105",
    "'user-juliana-pires'": "106",
    "'user-lucas-tavares'": "107",
    "'user-heloisa-martins'": "108",
    "'user-renata-souza'": "109",
    "'user-patricia-gomes'": "110",
    "'user-rafael-nogueira'": "111",
    "'user-eduardo-alves'": "112",
    "'user-talita-ramos'": "113",
    "'user-vinicius-prado'": "114",
    "'zone-zona-sul'": "201",
    "'zone-zona-norte'": "202",
    "'zone-zona-leste'": "203",
    "'zone-zona-oeste'": "204",
    "'zone-onco-oeste'": "301",
    "'zone-onco-sudeste'": "302",
    "'zone-cardio-nordeste'": "303",
    "'zone-cardio-sudoeste'": "304",
}

CRM_ID_PARAM_NAMES = [
    "id", "facilityId", "verticalId", "territoryId", "userId", "professionalId",
    "productId", "orderId", "managerId", "managerZoneId", "managerTerritoryId",
    "clinicId", "doctorId", "invitationId", "submissionId", "requirementId",
    "documentId", "fileAssetId", "definitionId", "familyId", "variantId",
    "representativeId", "facilityProfessionalId", "healthcareProviderId",
    "roleId", "suggestionId", "targetId", "zoneTerritoryId", "assignedUserId",
    "consultantUserId", "selectedVerticalId", "initialVerticalId",
    "preferredVerticalId", "selectedId", "focusId",
]


def replace_literals(content: str) -> str:
    for old, new in LITERAL_MAP.items():
        content = content.replace(old, new)
    return content


def fix_types(content: str) -> str:
    # Providers / typedefs still on String
    content = re.sub(
        r"FutureProvider<List<String>>\s*\(\s*\n",
        "FutureProvider<List<int>>(\n",
        content,
    )
    content = content.replace(
        "StateProvider<String?>(\n  (ref) => null,\n)",
        "StateProvider<int?>(\n  (ref) => null,\n)",
    )
    content = content.replace(
        "FutureProvider<String?>(\n  ref,\n) async {",
        "FutureProvider<int?>(\n  ref,\n) async {",
    )
    content = content.replace(
        "FutureProvider<String?>((",
        "FutureProvider<int?>((",
    )
    content = content.replace(
        "({int facilityId, String verticalId})",
        "({int facilityId, int verticalId})",
    )
    content = content.replace(
        "List<String?> repUserIds",
        "List<int?> repUserIds",
    )

    for name in CRM_ID_PARAM_NAMES:
        content = re.sub(
            rf"\bString\? {name}\b",
            f"int? {name}",
            content,
        )
        content = re.sub(
            rf"\brequired String {name}\b",
            f"required int {name}",
            content,
        )
        content = re.sub(
            rf"\bString {name}\b",
            f"int {name}",
            content,
        )

    # Riverpod family keys
    for name in ["facilityId", "clinicId", "userId", "orderId", "doctorId", "verticalId", "id"]:
        content = re.sub(
            rf"\.family<([^,>]+),\s*String>",
            lambda m, n=name: m.group(0),  # skip generic single pass
            content,
        )
    content = re.sub(
        r"\.family<([^,>]+),\s*String>",
        r".family<\1, int>",
        content,
    )
    content = re.sub(
        r"NotifierProvider\.family<([^,>]+),\s*String>",
        r"NotifierProvider.family<\1, int>",
        content,
    )
    content = re.sub(
        r"AutoDisposeNotifierProvider\.family<([^,>]+),\s*String>",
        r"AutoDisposeNotifierProvider.family<\1, int>",
        content,
    )

    # isEmpty / isNotEmpty on int ids
    for name in CRM_ID_PARAM_NAMES:
        content = re.sub(
            rf"\b{name}\.isNotEmpty\b",
            f"({name} != null && {name}! > 0)" if "?" in name else f"({name} > 0)",
            content,
        )
        content = re.sub(
            rf"\b{name}\.isEmpty\b",
            f"({name} == null || {name}! <= 0)" if False else f"({name} <= 0)",
            content,
        )

    # Common nullable vertical checks
    content = content.replace(
        "verticalId == null || verticalId.isEmpty",
        "verticalId == null",
    )
    content = content.replace(
        "verticalId != null && verticalId.isNotEmpty",
        "verticalId != null",
    )
    content = content.replace(
        "selected != null && verticalIds.contains(selected)",
        "selected != null && verticalIds.contains(selected)",
    )

    return content


def fix_mock_territory_builder(content: str) -> str:
    if "mock_territories_data.dart" not in content and "_buildMockTerritories" not in content:
        return content
    # Only for mock_territories_data file - handled separately
    return content


def process_file(path: Path) -> bool:
    original = path.read_text()
    updated = replace_literals(original)
    updated = fix_types(updated)
    if updated != original:
        path.write_text(updated)
        return True
    return False


def main() -> int:
    changed = 0
    for base in (LIB, TEST):
        for path in sorted(base.rglob("*.dart")):
            if process_file(path):
                changed += 1
    print(f"Pass2 changed {changed} files")

    # Special: mock_territories_data dynamic ids
    mt = LIB / "features/territories/data/mock/mock_territories_data.dart"
    if mt.exists():
        text = mt.read_text()
        text = text.replace(
            "final zoneId = 'territory-zone-${zoneSpec.idSuffix}';",
            "final zoneId = 100 + _zoneSpecs.indexOf(zoneSpec);",
        )
        text = text.replace(
            "final patchId = 'territory-patch-${zoneSpec.idSuffix}-$i';",
            "final patchId = 1000 + _zoneSpecs.indexOf(zoneSpec) * 10 + i;",
        )
        text = text.replace("code: zoneId.toUpperCase(),", "code: 'ZONE-${zoneSpec.idSuffix}'.toUpperCase(),")
        text = text.replace("code: patchId.toUpperCase(),", "code: 'PATCH-${zoneSpec.idSuffix}-$i'.toUpperCase(),")
        text = text.replace(
            "List<String?> repUserIds",
            "List<int?> repUserIds",
        )
        mt.write_text(text)
        print("Patched mock_territories_data.dart dynamic ids")

    result = subprocess.run(
        ["dart", "analyze"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    errors = sum(1 for line in result.stdout.splitlines() if "error -" in line)
    print(f"Analyzer errors: {errors}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
