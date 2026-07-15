// ── BRL formatter ───────────────────────────────────────────
String brl(double value) {
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
  return 'R\$${buf.toString().split('').reversed.join()},$decPart';
}
