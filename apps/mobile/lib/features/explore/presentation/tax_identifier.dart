class TaxIdentifier {
  final String label;
  final String value;

  const TaxIdentifier({required this.label, required this.value});

  @override
  bool operator ==(Object other) {
    return other is TaxIdentifier &&
        other.label == label &&
        other.value == value;
  }

  @override
  int get hashCode => Object.hash(label, value);
}

TaxIdentifier displayTaxIdentifier({
  String? legalDocumentType,
  String? legalDocument,
}) {
  final normalized = _normalizedValue(legalDocument);
  final type = legalDocumentType?.trim().toUpperCase();
  final isCpf =
      type == 'CPF' ||
      (type == null && normalized != null && _digits(normalized).length == 11);

  if (normalized != null) {
    return TaxIdentifier(
      label: isCpf ? 'CPF' : 'CNPJ',
      value: isCpf ? _formatCpf(normalized) : _formatCnpj(normalized),
    );
  }

  return TaxIdentifier(label: isCpf ? 'CPF' : 'CNPJ', value: '—');
}

/// Whether a CPF's check digits add up.
///
/// The third implementation of this rule, alongside `isValidCpfDigits` in the
/// API and `is_valid_cpf` in Postgres. None can be dropped: the database has to
/// filter rows for the warning's count and list, the server has to be the
/// authority for any client, and this one exists so a rep is told as they type
/// instead of after a round trip. All three answer the same fixture —
/// packages/database/fixtures/cpf-checksum-cases.json — so a fix applied to one
/// cannot pass while the others stay wrong.
///
/// Accepts punctuation and surrounding whitespace, since this runs against what
/// someone is typing or has pasted from a document.
bool isValidCpf(String? value) {
  final digits = _digits(value ?? '');
  if (digits.length != 11) return false;

  // 111.111.111-11 and friends satisfy the arithmetic but are not real CPFs,
  // and they are what gets typed to get past a required field.
  if (RegExp(r'^(\d)\1{10}$').hasMatch(digits)) return false;

  int checkDigit(int upTo) {
    var total = 0;
    for (var i = 0; i < upTo; i++) {
      total += int.parse(digits[i]) * (upTo + 1 - i);
    }
    final remainder = 11 - (total % 11);
    return remainder >= 10 ? 0 : remainder;
  }

  return checkDigit(9) == int.parse(digits[9]) &&
      checkDigit(10) == int.parse(digits[10]);
}

/// Why a clinic's CPF cannot be used, or null when it can.
///
/// Only meaningful for CPF clinics; a CNPJ clinic returns null whatever its
/// document, because that is a different problem and not the one the warning
/// counts.
CpfIssue? cpfIssueFor({String? legalDocumentType, String? legalDocument}) {
  if (legalDocumentType?.trim().toUpperCase() != 'CPF') return null;
  if (_normalizedValue(legalDocument) == null) return CpfIssue.missing;
  return isValidCpf(legalDocument) ? null : CpfIssue.invalid;
}

enum CpfIssue { missing, invalid }

String? _normalizedValue(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}

String _digits(String value) => value.replaceAll(RegExp(r'\D'), '');

String _formatCnpj(String value) {
  if (!RegExp(r'^[0-9./-]+$').hasMatch(value)) return value;

  final digits = _digits(value);
  if (digits.length != 14) return value;

  return '${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8, 12)}-${digits.substring(12)}';
}

String _formatCpf(String value) {
  if (!RegExp(r'^[0-9.-]+$').hasMatch(value)) return value;

  final digits = _digits(value);
  if (digits.length != 11) return value;

  return '${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}-${digits.substring(9)}';
}
