/// Desempenho donut → Explorar list filter (`purchaseFunnelStage` query param).
///
/// Mapeia os 3 buckets do dashboard para os estágios do funil de compra
/// (`PURCHASE_WINDOW`, `OUTSIDE_WINDOW`, `CHURN`, `NEVER_PURCHASED`,
/// `INACTIVE`) na tabela `facilities`:
///   active      → PURCHASE_WINDOW + OUTSIDE_WINDOW  (no funil)
///   inactive    → CHURN                              (risco)
///   neverBought → NEVER_PURCHASED + INACTIVE         (nunca compraram)
abstract final class PurchaseBucketFilter {
  static const active = 'active';
  static const inactive = 'inactive';
  static const neverBought = 'neverBought';

  static const values = [active, inactive, neverBought];

  static String label(String value) => switch (value) {
    active => 'No funil',
    inactive => 'Risco',
    neverBought => 'Nunca compraram',
    _ => value,
  };
}
