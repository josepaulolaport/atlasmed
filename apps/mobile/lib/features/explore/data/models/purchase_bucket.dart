/// Desempenho donut → Explorar list filter (`purchaseBucket` query param).
abstract final class PurchaseBucketFilter {
  static const active = 'active';
  static const inactive = 'inactive';
  static const neverBought = 'neverBought';

  static const values = [active, inactive, neverBought];

  static String label(String value) => switch (value) {
    active => 'Ativas',
    inactive => 'Inativas',
    neverBought => 'Nunca compraram',
    _ => value,
  };
}
