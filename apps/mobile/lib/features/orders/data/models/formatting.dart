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

/// Formats [value] as a BRL currency string, e.g. "R$ 1.840,00".
///
/// The one BRL formatter. There were two, disagreeing on both counts: the
/// catalog wrote "R$5.150,00" with no space, and Pedidos wrote "R$ 5301,00"
/// with a space and no thousands separator — so the same order was priced
/// two ways depending on the screen, and five-figure totals ran together.
String brl(double value) => 'R\$ ${brlNumber(value)}';

/// Parses a user-typed price such as "1.840,00", "1840,00" or "1840.00"
/// back into a [double] — the inverse of [brlNumber], used by admin forms
/// that let a rep type a price with a comma decimal separator. Returns
/// `null` when [input] isn't a valid number.
double? parseBrlNumber(String input) {
  final normalized = input.trim();
  if (normalized.isEmpty) return null;
  final hasComma = normalized.contains(',');
  final cleaned = hasComma
      ? normalized.replaceAll('.', '').replaceAll(',', '.')
      : normalized;
  return double.tryParse(cleaned);
}
