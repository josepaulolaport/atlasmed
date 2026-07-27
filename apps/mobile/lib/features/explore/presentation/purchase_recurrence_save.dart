import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

const purchaseRecurrenceSynchronizationWarning =
    'Perfil salvo, mas a lista não pôde ser atualizada agora.';

typedef PurchaseRecurrenceUpdate<T> =
    Future<T> Function(PurchaseRecurrenceCommand command);
typedef PurchaseRecurrenceRefresh<T> = Future<void> Function(T updated);

Future<void> savePurchaseRecurrence<T>({
  required PurchaseRecurrenceCommand command,
  required PurchaseRecurrenceUpdate<T> update,
  required void Function() close,
  required void Function() refreshDetail,
  required PurchaseRecurrenceRefresh<T> refreshExplore,
  required void Function(String message) showSynchronizationWarning,
}) async {
  final updated = await update(command);
  close();
  refreshDetail();
  try {
    await refreshExplore(updated);
  } catch (_) {
    showSynchronizationWarning(purchaseRecurrenceSynchronizationWarning);
  }
}
