/// Whether the prices on a catalog form differ from the ones already saved.
///
/// Background: both admin forms stamped `brasindiceUpdatedAt` to "now" on every
/// save, and the comparison table shows it as "Atualizado em" — so correcting a
/// typo in a manufacturer's name made a price from months ago read as refreshed
/// today.
///
/// This started life as `brasindiceDateForSave`, which fixed that by moving the
/// date only when a price moved. The variant form now asks the admin for the
/// date outright, because the column records when *Brasíndice* published the
/// price, and a price being edited on a Tuesday is not evidence that Brasíndice
/// published anything that Tuesday — the admin is usually typing in a table
/// released weeks earlier.
///
/// What survives is the comparison itself, which answers a question the form
/// still needs answered: the prices changed, so the date beside them is now
/// suspect and worth pointing at. Deriving the date was the wrong use of a
/// right idea.
///
/// A price that does not parse counts as a change rather than silently matching
/// — an unreadable field is not evidence that nothing moved.
bool brasindicePricesChanged({
  required List<double?> current,
  required List<double?> saved,
}) {
  if (current.length != saved.length) return true;
  for (var i = 0; i < current.length; i++) {
    if (current[i] != saved[i]) return true;
  }
  return false;
}
