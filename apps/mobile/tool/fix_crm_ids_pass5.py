#!/usr/bin/env python3
"""Pass 5: provider family keys String -> int for facilityId."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REPLACEMENTS = [
    (r"\.family<([^>]+),\s*String>\(\s*\(ref,\s*facilityId", r".family<\1, int>((ref, facilityId"),
    (r"\.family<([^>]+),\s*String>\(\s*\(ref,\s*id\)", r".family<\1, int>((ref, id)"),
    (r"NotifierProvider\.family<([^,]+),\s*([^,]+),\s*String>", r"NotifierProvider.family<\1, \2, int>"),
    (r"AutoDisposeNotifierProvider\.family<([^,]+),\s*([^,]+),\s*String>", r"AutoDisposeNotifierProvider.family<\1, \2, int>"),
    (r"FutureProvider\.family<([^,]+),\s*String>", r"FutureProvider.family<\1, int>"),
    (r"Provider\.family<([^,]+),\s*String>", r"Provider.family<\1, int>"),
    (r"StateNotifierProvider\.family<([^,]+),\s*String>", r"StateNotifierProvider.family<\1, int>"),
    (r"String\? verticalId\)", r"int? verticalId)"),
    (r"DashboardRepository\(\{String\? verticalId\}\)", r"DashboardRepository({int? verticalId})"),
    (r"DashboardRepository\(\{required String\? verticalId\}\)", r"DashboardRepository({int? verticalId})"),
]


def main() -> int:
    changed = 0
    for base in (ROOT / "lib", ROOT / "test"):
        for path in sorted(base.rglob("*.dart")):
            original = path.read_text()
            updated = original
            for pattern, repl in REPLACEMENTS:
                updated = re.sub(pattern, repl, updated)
            if updated != original:
                path.write_text(updated)
                changed += 1
    result = subprocess.run(["dart", "analyze"], cwd=ROOT, capture_output=True, text=True)
    errors = sum(1 for line in result.stdout.splitlines() if "error -" in line)
    print(f"Pass5 changed {changed} files, errors: {errors}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
