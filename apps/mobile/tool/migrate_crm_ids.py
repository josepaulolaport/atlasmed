#!/usr/bin/env python3
"""One-shot migration: CRM entity ids String -> int in apps/mobile."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "lib"
TEST = ROOT / "test"

# CRM FK / entity id field names (camelCase suffix Id or bare id).
CRM_ID_FIELDS = {
    "id",
    "facilityId",
    "verticalId",
    "territoryId",
    "userId",
    "professionalId",
    "productId",
    "orderId",
    "managerId",
    "managerZoneId",
    "managerTerritoryId",
    "clinicId",
    "doctorId",
    "invitationId",
    "submissionId",
    "requirementId",
    "documentId",
    "fileAssetId",
    "definitionId",
    "familyId",
    "variantId",
    "representativeId",
    "facilityProfessionalId",
    "healthcareProviderId",
    "roleId",
    "suggestionId",
    "targetId",
    "zoneTerritoryId",
    "assignedUserId",
    "consultantUserId",
    "selectedVerticalId",
    "preferredVerticalId",
    "initialVerticalId",
    "queryVerticalId",
    "fallbackEffectiveId",
    "initiallySelectedId",
    "selectedId",  # when CRM entity picker
    "focusId",
    "productIds",  # keep as String? - comma-separated query param
}

# Files/fields where `id` must stay String (non-CRM keys).
KEEP_STRING_ID_FILES = {
    "editable_field_row.dart",
    "registration_document_compose_screen.dart",  # local compose row id
    "cadastro_document_pages_preview.dart",
    "edit_payer_sources_screen.dart",  # local payer row id in form
    "payer_catalog_mock.dart",
    "payer_display.dart",
    "establishment_detail_mock.dart",
}

KEEP_STRING_FIELDS = {
    "displayId",
    "idSuffix",
    "resourceId",
    "productIds",
    "serviceCode",
    "classificationCode",
    "taxId",
    "taxIdType",
    "cnesCode",
    "bucket",
    "fileId",  # upload temp id may differ - check per file
}

CRM_JSON_FIELDS = CRM_ID_FIELDS - {"productIds", "selectedId"} | {"territoryIds", "facilityIds", "verticalIds", "managerIds"}


def needs_crm_import(content: str) -> bool:
    return "readCrmId" in content or "parseRouteCrmId" in content


def ensure_import(content: str) -> str:
    import_line = "import 'package:atlasmed_mobile_app/core/json/crm_id.dart';"
    if import_line in content:
        return content
    if not needs_crm_import(content):
        return content
    # Insert after first import block.
    lines = content.splitlines(keepends=True)
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1
        elif insert_at > 0 and not line.startswith("import "):
            break
    lines.insert(insert_at, import_line + "\n")
    return "".join(lines)


def field_is_crm(name: str, filename: str) -> bool:
    if name in KEEP_STRING_FIELDS:
        return False
    if name == "id" and filename in KEEP_STRING_ID_FILES:
        return False
    if name == "selectedId":
        # CRM pickers in catalog/product screens
        return True
    if name.endswith("Id") or name.endswith("Ids"):
        base = name
        if base.endswith("Ids"):
            base = base[:-1]
        if base in CRM_ID_FIELDS or name in CRM_ID_FIELDS:
            return True
        if name.endswith("Id") and name[:-2] + "Id" in CRM_ID_FIELDS:
            return True
        # heuristic: *Id suffix => CRM unless in keep list
        return name not in KEEP_STRING_FIELDS
    return name == "id"


def replace_type_declarations(content: str, filename: str) -> str:
    def repl_final_nullable(m: re.Match[str]) -> str:
        field = m.group(1)
        if not field_is_crm(field, filename):
            return m.group(0)
        return f"final int? {field};"

    def repl_final(m: re.Match[str]) -> str:
        field = m.group(1)
        if not field_is_crm(field, filename):
            return m.group(0)
        return f"final int {field};"

    content = re.sub(r"final String\? (\w+);", repl_final_nullable, content)
    content = re.sub(r"final String (\w+);", repl_final, content)

    def repl_param(m: re.Match[str]) -> str:
        field = m.group(2)
        if not field_is_crm(field, filename):
            return m.group(0)
        if m.group(1):
            return f"int? {field}"
        return f"required int {field}" if "required" in m.group(0) else f"int {field}"

    content = re.sub(
        r"required String\? (\w+)",
        lambda m: f"int? {m.group(1)}" if field_is_crm(m.group(1), filename) else m.group(0),
        content,
    )
    content = re.sub(
        r"required String (\w+)",
        lambda m: f"required int {m.group(1)}" if field_is_crm(m.group(1), filename) else m.group(0),
        content,
    )
    content = re.sub(
        r"\{String\? (\w+)",
        lambda m: f"{{int? {m.group(1)}" if field_is_crm(m.group(1), filename) else m.group(0),
        content,
    )
    content = re.sub(
        r"String\? (\w+),",
        lambda m: f"int? {m.group(1)}," if field_is_crm(m.group(1), filename) else m.group(0),
        content,
    )
    content = re.sub(
        r"String (\w+),",
        lambda m: f"int {m.group(1)}," if field_is_crm(m.group(1), filename) else m.group(0),
        content,
    )
    content = re.sub(
        r"String (\w+)\)",
        lambda m: f"int {m.group(1)})" if field_is_crm(m.group(1), filename) else m.group(0),
        content,
    )
    content = re.sub(
        r"String\? (\w+)\)",
        lambda m: f"int? {m.group(1)})" if field_is_crm(m.group(1), filename) else m.group(0),
        content,
    )
    content = re.sub(
        r"List<String> (\w+)",
        lambda m: f"List<int> {m.group(1)}"
        if m.group(1) in {"territoryIds", "facilityIds", "verticalIds", "managerIds"}
        else m.group(0),
        content,
    )
    return content


def replace_json_parsing(content: str) -> str:
    # json['field'] as String -> readCrmId
    for field in sorted(CRM_JSON_FIELDS, key=len, reverse=True):
        content = re.sub(
            rf"(\w+)\['{field}'\] as String\??",
            lambda m, f=field: f"readCrmIdOrNull({m.group(1)}['{f}'], '{f}')"
            if "?" in m.group(0)
            else f"readCrmId({m.group(1)}['{f}'], '{f}')",
            content,
        )
        content = re.sub(
            rf"readString\((\w+)\['{field}'\]\)",
            f"readCrmId(\\1['{field}'], '{field}')",
            content,
        )
        content = re.sub(
            rf"readNullableString\((\w+)\['{field}'\]\)",
            f"readCrmIdOrNull(\\1['{field}'], '{field}')",
            content,
        )
    # path parameters
    content = content.replace(
        "state.pathParameters['id']!",
        "parseRouteCrmId(state.pathParameters['id']!)",
    )
    content = content.replace(
        "state.pathParameters['invitationId']!",
        "parseRouteCrmId(state.pathParameters['invitationId']!, 'invitationId')",
    )
    content = content.replace(
        "state.pathParameters['familyId']!",
        "parseRouteCrmId(state.pathParameters['familyId']!, 'familyId')",
    )
    content = content.replace(
        "state.pathParameters['variantId']!",
        "parseRouteCrmId(state.pathParameters['variantId']!, 'variantId')",
    )
    content = content.replace(
        "state.pathParameters['invitationId']",
        "state.pathParameters['invitationId'] != null ? parseRouteCrmId(state.pathParameters['invitationId']!, 'invitationId') : null",
    )
    # query params verticalId / facilityId
    content = re.sub(
        r"state\.uri\.queryParameters\['verticalId'\]",
        "parseRouteCrmIdOrNull(state.uri.queryParameters['verticalId'], 'verticalId')",
        content,
    )
    content = re.sub(
        r"state\.uri\.queryParameters\['facilityId'\]",
        "parseRouteCrmIdOrNull(state.uri.queryParameters['facilityId'], 'facilityId')",
        content,
    )
    # verticalId.isNotEmpty filter
    content = content.replace(
        "p.verticalId.isNotEmpty",
        "p.verticalId > 0",
    )
    return content


def process_file(path: Path) -> bool:
    original = path.read_text()
    filename = path.name
    updated = replace_type_declarations(original, filename)
    updated = replace_json_parsing(updated)
    updated = ensure_import(updated)
    if updated != original:
        path.write_text(updated)
        return True
    return False


def main() -> int:
    changed = 0
    for base in (LIB, TEST):
        if not base.exists():
            continue
        for path in sorted(base.rglob("*.dart")):
            if process_file(path):
                changed += 1
                print(path.relative_to(ROOT))
    print(f"\nChanged {changed} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
