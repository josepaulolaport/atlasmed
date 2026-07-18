/// `dd/mm/aaaa` formatting shared across the users feature's screens —
/// kept local (no `intl` dependency) to match the rest of the mobile app.
String formatDate(DateTime date) {
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  return '$day/$month/${date.year}';
}

/// `dd/mm/aaaa às HH:mm` — used where the time of day matters (e.g. last
/// login), not just the day.
String formatDateTime(DateTime date) {
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '${formatDate(date)} às $hour:$minute';
}
