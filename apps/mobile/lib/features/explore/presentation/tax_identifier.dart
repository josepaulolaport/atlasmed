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
  String? taxIdType,
  String? cnpj,
  String? cpf,
}) {
  final normalizedCnpj = _normalizedValue(cnpj);
  if (normalizedCnpj != null) {
    return TaxIdentifier(label: 'CNPJ', value: _formatCnpj(normalizedCnpj));
  }

  final normalizedCpf = _normalizedValue(cpf);
  if (normalizedCpf != null) {
    return TaxIdentifier(label: 'CPF', value: _formatCpf(normalizedCpf));
  }

  return TaxIdentifier(label: taxIdType == 'PF' ? 'CPF' : 'CNPJ', value: '—');
}

String? _normalizedValue(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}

String _formatCnpj(String value) {
  if (!RegExp(r'^[0-9./-]+$').hasMatch(value)) return value;

  final digits = value.replaceAll(RegExp(r'\D'), '');
  if (digits.length != 14) return value;

  return '${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8, 12)}-${digits.substring(12)}';
}

String _formatCpf(String value) {
  if (!RegExp(r'^[0-9.-]+$').hasMatch(value)) return value;

  final digits = value.replaceAll(RegExp(r'\D'), '');
  if (digits.length != 11) return value;

  return '${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}-${digits.substring(9)}';
}
