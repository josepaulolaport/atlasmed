#!/usr/bin/env python3
"""Pass 4: mock facility id helpers + int vertical scope fixes."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORT = "import 'package:atlasmed_mobile_app/core/json/crm_id.dart';"

MOCK_CHECK_REPLACEMENTS = [
    (
        r"!(\w+)\.startsWith\('near-'\) && !\1\.endsWith\(':empty'\)",
        r"!isMockFacilityId(\1)",
    ),
    (
        r"(\w+)\.startsWith\('near-'\) \|\| \1\.endsWith\(':empty'\)",
        r"isMockFacilityId(\1)",
    ),
    (r"(\w+)\.endsWith\(':empty'\)", r"isMockEmptyFacilityId(\1)"),
    (r"(\w+)\.startsWith\('near-'\)", r"isMockNearbyFacilityId(\1)"),
]

BROKEN_SYNTAX = [
    (r"(\w+)\.\(id > 0\)", r"\1.id > 0"),
    (r"(\w+)\.\(id <= 0\)", r"\1.id <= 0"),
    (r"entryId == null \|\| entryId\.isEmpty", r"entryId == null"),
    (r"verticalId == null \|\| verticalId\.isEmpty", r"verticalId == null"),
    (r"verticalId != null && verticalId\.isNotEmpty", r"verticalId != null"),
]


def ensure_import(content: str) -> str:
    if IMPORT in content or "isMockFacilityId" not in content:
        return content
    lines = content.splitlines(keepends=True)
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, IMPORT + "\n")
    return "".join(lines)


def process(content: str) -> str:
    for pattern, repl in BROKEN_SYNTAX:
        content = re.sub(pattern, repl, content)
    for pattern, repl in MOCK_CHECK_REPLACEMENTS:
        content = re.sub(pattern, repl, content)
    content = re.sub(r"\bid: 'near-(\d+)'", r"id: -\1", content)
    content = ensure_import(content)
    return content


def fix_linha_provider(content: str) -> str:
    content = content.replace(
        "StateProvider.autoDispose\n    .family<String?, int>",
        "StateProvider.autoDispose\n    .family<int?, int>",
    )
    content = content.replace(
        "StateProvider.autoDispose\n    .family<Set<String>, String>",
        "StateProvider.autoDispose\n    .family<Set<int>, int>",
    )
    content = content.replace("String? resolveClinicDetailActiveLinhaId", "int? resolveClinicDetailActiveLinhaId")
    content = content.replace("Provider.autoDispose\n    .family<String?, int>", "Provider.autoDispose\n    .family<int?, int>")
    content = content.replace("required String? clinicOverride", "required int? clinicOverride")
    content = content.replace("required String? exploreSelected", "required int? exploreSelected")
    content = content.replace("required String? dashboardSelected", "required int? dashboardSelected")
    content = content.replace("required String? effectiveFallback", "required int? effectiveFallback")
    return content


def fix_nearby_provider(content: str) -> str:
    content = content.replace("Set<String> sharedNearbyVerticalIds", "Set<int> sharedNearbyVerticalIds")
    content = content.replace("required Iterable<String> clinicVerticalIds", "required Iterable<int> clinicVerticalIds")
    content = content.replace("required Iterable<String> userVerticalIds", "required Iterable<int> userVerticalIds")
    content = content.replace("String? resolveNearbyVerticalId", "int? resolveNearbyVerticalId")
    content = content.replace("Set<String> sharedVerticalIds", "Set<int> sharedVerticalIds")
    content = content.replace(
        "FutureProvider.family<List<NearbyEstablishment>, String>",
        "FutureProvider.family<List<NearbyEstablishment>, int>",
    )
    return content


def main() -> int:
    changed = 0
    for base in (ROOT / "lib", ROOT / "test"):
        for path in sorted(base.rglob("*.dart")):
            if path.name == "crm_id.dart":
                continue
            original = path.read_text()
            updated = process(original)
            if path.name == "clinic_detail_linha_provider.dart":
                updated = fix_linha_provider(updated)
            if path.name == "facility_nearby_provider.dart":
                updated = fix_nearby_provider(updated)
            if path.name == "facility_nearby_repository.dart":
                updated = re.sub(
                    r"bool isMockNearbyFacilityId\(int facilityId\) =>[\s\S]*?;",
                    "bool isMockNearbyFacilityId(int facilityId) =>\n    isMockNearbyFacilityId(facilityId);",
                    updated,
                )
                # fix recursion - replace whole function properly
                updated = original
                updated = process(updated)
                updated = updated.replace(
                    "bool isMockNearbyFacilityId(int facilityId) =>\n    facilityId.startsWith('near-') || facilityId.endsWith(':empty');",
                    "// re-exported from crm_id.dart\n",
                )
                if "isMockNearbyFacilityId" in updated and IMPORT not in updated:
                    updated = IMPORT + "\n" + updated
            if updated != original:
                path.write_text(updated)
                changed += 1

    repo = ROOT / "lib/features/explore/data/repositories/facility_nearby_repository.dart"
    text = repo.read_text()
    text = re.sub(
        r"bool isMockNearbyFacilityId\(int facilityId\) =>.*?;",
        "",
        text,
        flags=re.DOTALL,
    )
    if IMPORT not in text:
        text = IMPORT + "\n" + text
    repo.write_text(text)

    result = subprocess.run(["dart", "analyze"], cwd=ROOT, capture_output=True, text=True)
    errors = sum(1 for line in result.stdout.splitlines() if "error -" in line)
    print(f"Pass4 changed {changed} files, errors: {errors}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
