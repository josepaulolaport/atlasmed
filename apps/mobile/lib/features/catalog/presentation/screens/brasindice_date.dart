/// When the Brasíndice prices were last actually refreshed.
///
/// Both admin forms stamped this to "now" on every save, and the comparison
/// table shows it as "Atualizado em" — so correcting a typo in a
/// manufacturer's name made a price from months ago read as refreshed today.
/// Only a price change may move the date.
///
/// [existing] is null when the record is being created, in which case today is
/// right: its prices are being entered now.
DateTime? brasindiceDateForSave({
  required DateTime? existing,
  required List<double?> currentPrices,
  required List<double?> savedPrices,
  required DateTime now,
}) {
  if (existing == null && savedPrices.isEmpty) return now;
  if (currentPrices.length != savedPrices.length) return now;
  for (var i = 0; i < currentPrices.length; i++) {
    if (currentPrices[i] != savedPrices[i]) return now;
  }
  return existing;
}
