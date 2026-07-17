// ── BRL formatter ───────────────────────────────────────────

/// Formats [value] as a plain BRL number, e.g. "1.840,00" — no "R$" prefix.
String brlNumber(double value) {
  final parts = value.toStringAsFixed(2).split('.');
  final intPart = parts[0];
  final decPart = parts[1];
  final buf = StringBuffer();
  int count = 0;
  for (int i = intPart.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 == 0) buf.write('.');
    buf.write(intPart[i]);
    count++;
  }
  return '${buf.toString().split('').reversed.join()},$decPart';
}

/// Formats [value] as a BRL currency string, e.g. "R$1.840,00".
String brl(double value) => 'R\$${brlNumber(value)}';
