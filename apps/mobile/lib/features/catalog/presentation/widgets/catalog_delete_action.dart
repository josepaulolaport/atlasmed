import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/product_deletability.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// The trash button on a catalogue form, and the two conversations behind it.
///
/// Spec 0016 §6.2 makes delete conditional: a row nothing references can go, a
/// row something references cannot, and the refusal names what blocks it and
/// points at deactivation instead. Both product forms use this so the two
/// cannot phrase the same rule differently.
class CatalogDeleteButton extends StatelessWidget {
  const CatalogDeleteButton({
    super.key,
    required this.deletability,
    required this.onDelete,
    required this.blockedTitle,
  });

  /// Null while the answer is still loading — the button is shown disabled
  /// rather than absent, so it does not appear once the request lands.
  final ProductDeletability? deletability;
  final VoidCallback onDelete;

  /// e.g. "Este produto não pode ser excluído".
  final String blockedTitle;

  @override
  Widget build(BuildContext context) {
    final answer = deletability;
    final enabled = answer?.deletable ?? false;

    return IconButton(
      tooltip: switch (answer) {
        null => 'Verificando…',
        final a when a.deletable => 'Excluir',
        final a => 'Bloqueado por ${a.blockedByLabel}',
      },
      onPressed: answer == null
          ? null
          : enabled
          ? onDelete
          : () => showBlockedDeleteDialog(
              context,
              title: blockedTitle,
              deletability: answer,
            ),
      icon: Icon(
        Icons.delete_outline_rounded,
        color: enabled ? AppColors.error : AppColors.gray400,
      ),
    );
  }
}

/// Confirms a delete that will actually happen. Returns true when confirmed.
///
/// [referencesLabel] names what *would* have blocked it, in this entity's own
/// vocabulary. It defaults to the catalogue's, and a caller whose row is
/// referenced by something else must pass its own — telling an admin their
/// document is free of "pedidos e equivalências" is noise at best and wrong at
/// worst.
Future<bool> confirmCatalogDelete(
  BuildContext context, {
  required String name,
  required String kind,
  String referencesLabel =
      'nenhum pedido, quantidade, equivalência ou métrica',
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text('Excluir $kind?'),
      content: Text(
        '“$name” será removido definitivamente. Isso só é possível porque nada '
        'no sistema faz referência a ele — $referencesLabel.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: AppColors.error),
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Excluir'),
        ),
      ],
    ),
  );
  return confirmed ?? false;
}

/// Explains a refusal, names what blocks it, and points at the alternative.
///
/// Deliberately not a "delete anyway" dialog: `product_equivalences` cascades,
/// so forcing it would silently drop equivalences a rep's picker depends on, and
/// `facility_product_usage` is `ON DELETE RESTRICT`, so it would fail mid-
/// transaction with nothing an admin could act on.
void showBlockedDeleteDialog(
  BuildContext context, {
  required String title,
  required ProductDeletability deletability,
}) {
  final blockers = deletability.blockedByLabel;
  // "1 resposta de clínica … que depende dele", "2 pedidos … que dependem dele".
  final verb = deletability.blocksJustOne ? 'depende' : 'dependem';
  showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(
        blockers.isEmpty
            ? 'Há registros no sistema que dependem dele.'
            : 'Há $blockers no sistema que $verb dele. Os dados já '
                  'registrados em campo nunca são apagados por uma edição de '
                  'catálogo.\n\nPara tirá-lo de circulação, desmarque “Ativo” '
                  'e salve: ele some das listas dos representantes e continua '
                  'valendo para o histórico.',
      ),
      actions: [
        FilledButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Entendi'),
        ),
      ],
    ),
  );
}

/// Turns a failed delete into the same conversation as a pre-checked block.
///
/// The check and the delete are two requests, so an order can land between them.
/// When it does the API answers 409 with the counts, and the admin sees the same
/// dialog rather than a raw error.
void showDeleteFailure(
  BuildContext context, {
  required String blockedTitle,
  required Object error,
}) {
  if (error is CatalogApiException && error.statusCode == 409) {
    showBlockedDeleteDialog(
      context,
      title: blockedTitle,
      deletability: ProductDeletability(
        deletable: false,
        blockedBy: error.blockedBy,
      ),
    );
    return;
  }
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(
        error is CatalogApiException
            ? error.message
            : 'Não foi possível excluir. Tente novamente.',
      ),
    ),
  );
}
