#!/usr/bin/env python3
"""Pass 3: replace remaining mock string CRM id literals with ints."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXTRA_MAP = {
    "'zone-centro'": "205",
    "'zone-cardio-oeste'": "206",
    "'zone-leste'": "207",
    "'zone-vazia-abc'": "208",
    "'zone-vazia-def'": "209",
    "'user-otavio-barros'": "115",
    "'user-carla-medeiros'": "116",
    "'user-priscila-farah'": "117",
    "'user-thiago-nunes'": "118",
    "'user-admin-root'": "119",
    "'user-igor-santana'": "120",
    "'role-admin'": "10",
    "'role-manager'": "11",
    "'role-rep'": "12",
    "'role-ops'": "13",
    "'billing_email'": "9001",  # form field key wrongly typed - skip
}

TERRITORY_LITERALS = {
    "'territory-sul-onco-a'": "401",
    "'territory-sul-onco-b'": "402",
    "'territory-sul-onco-c'": "403",
    "'territory-sul-onco-d'": "404",
    "'territory-sul-cardio-a'": "405",
    "'territory-sul-cardio-b'": "406",
    "'territory-sul-cardio-c'": "407",
    "'territory-norte-onco-a'": "408",
    "'territory-norte-onco-b'": "409",
    "'territory-norte-onco-c'": "410",
    "'territory-norte-cardio-a'": "411",
    "'territory-norte-cardio-b'": "412",
    "'territory-centro-onco-a'": "413",
    "'territory-centro-onco-b'": "414",
    "'territory-centro-onco-c'": "415",
    "'territory-centro-onco-d'": "416",
    "'territory-oeste-cardio-a'": "417",
    "'territory-oeste-cardio-b'": "418",
    "'territory-oeste-cardio-c'": "419",
    "'territory-oeste-cardio-d'": "420",
    "'territory-leste-onco-a'": "421",
    "'territory-leste-onco-b'": "422",
    "'territory-leste-cardio-a'": "423",
    "'territory-leste-cardio-b'": "424",
    "'territory-leste-cardio-c'": "425",
}

REGEX_REPLACEMENTS = [
    (r"\bid: 'hp-(\d+)'", r"id: \1"),
    (r"\bid: 'ord-(\d+)'", r"id: \1"),
    (r"\bid: 'invite-(\d+)'", r"id: \1"),
    (r"\bid: 'hp-cat-(\d+)'", r"id: \1"),
    (r"\bid: 'grant-(\d+)'", r"id: \1"),
    (r"\bid: 'grant-\$\{_grantSeq\+\+\}'", r"id: 500"),  # won't match
    (r"\bid: 'fac-(\d+)'", r"id: \1"),
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
    (r"\bid: 'fp-(\d+)'", r"id: \1"),
    (r"\bid: 'rep-(\d+)'", r"id: \1"),
    (r"\bid: 'nc-(\d+)'", r"id: \1"),
    (r"roleId: 'role-(\w+)'", None),  # handled by map
    (r"territoryId: 'zone-[^']+'", None),
    (r"managerTerritoryId: 'zone-[^']+'", None),
    (r"verticalId: 'sector-[^']+'", None),
]

ROLE_MAP = {
    "'role-admin'": "10",
    "'role-manager'": "11",
    "'role-rep'": "12",
    "'role-ops'": "13",
}


def process(content: str, filename: str) -> str:
    # Skip files where id is intentionally a form/UI key
    if filename in {
        "editable_field_row.dart",
        "registration_document_compose_screen.dart",
        "facility_cadastro_repository.dart",
        "create_doctor_profile_sheet.dart",
    }:
        return content

    for old, new in {**EXTRA_MAP, **TERRITORY_LITERALS, **ROLE_MAP}.items():
        content = content.replace(old, new)

    for pattern, repl in REGEX_REPLACEMENTS:
        if repl:
            content = re.sub(pattern, repl, content)

    content = re.sub(r"roleId: 'role-admin'", "roleId: 10", content)
    content = re.sub(r"roleId: 'role-manager'", "roleId: 11", content)
    content = re.sub(r"roleId: 'role-rep'", "roleId: 12", content)
    content = re.sub(r"roleId: 'role-ops'", "roleId: 13", content)

    content = content.replace("territoryId: 'zone-centro'", "territoryId: 205")
    content = content.replace("territoryId: 'zone-cardio-oeste'", "territoryId: 206")
    content = content.replace("territoryId: 'zone-leste'", "territoryId: 207")
    content = content.replace("managerTerritoryId: 'zone-centro'", "managerTerritoryId: 205")
    content = content.replace(
        "managerTerritoryId: 'zone-cardio-oeste'", "managerTerritoryId: 206"
    )
    content = content.replace("managerTerritoryId: 'zone-leste'", "managerTerritoryId: 207")

    # Dynamic grant id in mock repo
    content = content.replace(
        "id: 'grant-${_grantSeq++}'",
        "id: 500 + _grantSeq++",
    )

  # payer catalog - id field is CRM healthcare provider
    if "payer_catalog_mock.dart" in filename or "payer_display.dart" in filename:
        content = re.sub(r"PayerCatalogEntry\(id: 'hp-cat-(\d+)'", r"PayerCatalogEntry(id: \1", content)

    return content


def main() -> int:
    changed = 0
    for base in (ROOT / "lib", ROOT / "test"):
        for path in sorted(base.rglob("*.dart")):
            original = path.read_text()
            updated = process(original, path.name)
            if updated != original:
                path.write_text(updated)
                changed += 1
    print(f"Pass3 changed {changed} files")
    result = subprocess.run(["dart", "analyze"], cwd=ROOT, capture_output=True, text=True)
    errors = sum(1 for line in result.stdout.splitlines() if "error -" in line)
    print(f"Analyzer errors: {errors}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
