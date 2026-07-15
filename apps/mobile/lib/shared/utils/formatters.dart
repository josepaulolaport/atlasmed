// pt-BR formatting helpers shared across features.

/// Formats a value as Brazilian Real, e.g. `1840.0` -> `R$ 1.840,00`.
String formatBrl(double value) {
  final negative = value < 0;
  final fixed = value.abs().toStringAsFixed(2);
  final parts = fixed.split('.');
  final intPart = parts[0];
  final decPart = parts[1];

  final buffer = StringBuffer();
  for (var i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 == 0) buffer.write('.');
    buffer.write(intPart[i]);
  }
  return '${negative ? '-' : ''}R\$ $buffer,$decPart';
}

/// Formats a [DateTime] as `dd/MM/aaaa`.
String formatDateBr(DateTime date) {
  final d = date.day.toString().padLeft(2, '0');
  final m = date.month.toString().padLeft(2, '0');
  return '$d/$m/${date.year}';
}
