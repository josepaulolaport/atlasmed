/// Whether a catalogue row can be hard-deleted, and what stops it.
///
/// Spec 0016 §6.2: delete is conditional, not absolute. A product nothing points
/// at is a mistake someone wants gone; one with orders, recorded quantities,
/// equivalences or a metric link is history, and removing it would either
/// cascade over field-collected data or fail on a foreign key. So the refusal
/// has to name what blocks it, and the answer is deactivation instead.
class ProductDeletability {
  const ProductDeletability({required this.deletable, required this.blockedBy});

  final bool deletable;

  /// Counts by relation, e.g. `{orderItems: 3, productEquivalences: 1}`.
  /// Empty when [deletable] is true.
  final Map<String, int> blockedBy;

  static const unknown = ProductDeletability(deletable: false, blockedBy: {});

  factory ProductDeletability.fromJson(Map<String, dynamic> json) {
    final raw = json['blockingReferences'];
    return ProductDeletability(
      // Defaults to *not* deletable. An API that stopped sending the field
      // should hide the action, not offer one that cannot be trusted.
      deletable: json['deletable'] as bool? ?? false,
      blockedBy: raw is Map
          ? {
              for (final entry in raw.entries)
                if (entry.value is num)
                  '${entry.key}': (entry.value as num).toInt(),
            }
          : const {},
    );
  }

  /// Whether [blockedByLabel] names exactly one thing, so the sentence around it
  /// can agree with it: "Há 1 resposta de clínica … que **depende** dele" rather
  /// than "que dependem dele".
  bool get blocksJustOne =>
      blockedBy.values.where((count) => count > 0).length == 1 &&
      blockedBy.values.where((count) => count > 0).first == 1;

  /// The refusal in Portuguese, e.g. "3 pedidos e 1 equivalência".
  ///
  /// Named per relation rather than as a generic count, because the admin's next
  /// move differs: an order is history and means deactivate, a stray equivalence
  /// is something they can remove and retry.
  String get blockedByLabel {
    // Fixed order, not the map's: JSON key order is the API's business, and the
    // same block reading differently on two screens is noise. Ordered by how
    // final each blocker is — an order is history and settles the question, a
    // metric link is something the admin can undo and retry.
    const order = [
      'orderItems',
      'facilityProductUsage',
      'productEquivalences',
      'productPotentialLinks',
      'conformityRecords',
      'submissionDocuments',
    ];
    final parts = <String>[
      for (final relation in order)
        if ((blockedBy[relation] ?? 0) > 0)
          _labelFor(relation, blockedBy[relation]!),
      // Anything the API adds later still shows up, just last.
      for (final entry in blockedBy.entries)
        if (!order.contains(entry.key) && entry.value > 0)
          _labelFor(entry.key, entry.value),
    ];
    if (parts.isEmpty) return '';
    if (parts.length == 1) return parts.first;
    return '${parts.sublist(0, parts.length - 1).join(', ')} e ${parts.last}';
  }

  static String _labelFor(String relation, int count) {
    final plural = count != 1;
    return switch (relation) {
      'orderItems' => '$count ${plural ? 'itens de pedido' : 'item de pedido'}',
      'facilityProductUsage' =>
        '$count ${plural ? 'quantidades registradas' : 'quantidade registrada'}',
      'productEquivalences' =>
        '$count ${plural ? 'equivalências' : 'equivalência'}',
      'productPotentialLinks' =>
        '$count ${plural ? 'vínculos com métricas' : 'vínculo com métrica'}',
      // Noun phrases, not clauses: the sentence around them reads "Há <label>
      // no sistema que dependem dele", so "1 clínica que já respondeu" produced
      // "que dependem dele" attached to a verb phrase.
      'conformityRecords' =>
        '$count ${plural ? 'respostas de clínicas' : 'resposta de clínica'}',
      'submissionDocuments' =>
        '$count ${plural ? 'documentos enviados' : 'documento enviado'}',
      // A relation the API added and this build has not learned. Showing the raw
      // key is ugly but honest; showing nothing would claim the row is free to
      // delete when it is not.
      _ => '$count $relation',
    };
  }
}
