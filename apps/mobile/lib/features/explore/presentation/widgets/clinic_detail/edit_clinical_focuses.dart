import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinical_focuses_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/tag_selection_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinical_focuses_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/tag_editor_sheet.dart';

/// Opens the clinical focus editor and refreshes the clinic once it saves.
///
/// Lives on Dados administrativos rather than on the clinic header. The header
/// is what a rep reads on arrival — name, focus, status, address — and putting
/// an edit control in it made the one glanceable surface also the editing one.
/// Every other field of this kind is changed from the administrative page, so
/// this now is too.
///
/// Applied straight away rather than filed as a suggestion: a foco clínico is a
/// catalogue tag learned on site, not one of the identity fields the review
/// queue exists to guard. It is therefore *not* gated on
/// `canCreateFieldSuggestionProvider` like the rows around it — that permission
/// is about proposing changes for review, which this is not.
Future<void> showClinicalFocusEditor(
  BuildContext context,
  WidgetRef ref, {
  required Facility detail,
}) async {
  final catalog = ref.read(clinicalFocusesRepositoryProvider);
  final List<ClinicalFocusOption> options;
  try {
    options = await catalog.currentValueOrResolve() ?? const [];
  } catch (error) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Não foi possível carregar os focos clínicos: $error'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    return;
  }
  if (!context.mounted) return;

  final saved = await TagEditorSheet.show(
    context,
    copy: TagEditorCopy.clinicalFocus,
    options: [
      for (final option in options)
        TagOption(id: option.id, label: option.label),
    ],
    selectedIds: detail.clinicalFocuses.map((f) => f.id).toSet(),
    primaryId: detail.clinicalFocuses
        .where((f) => f.isPrimary)
        .map((f) => f.id)
        .firstOrNull,
    onSave: (result) => TagSelectionRepository().saveClinicalFocuses(
      facilityId: detail.id,
      focuses: [
        for (final id in result.selectedIds)
          TagSelection(id: id, isPrimary: id == result.primaryId),
      ],
    ),
  );

  if (saved == null || !context.mounted) return;
  // The chips and this row both read the detail payload, so the write is only
  // visible once it is refetched.
  ref.invalidate(clinicDetailRepositoryProvider(detail.id));
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text('Focos clínicos atualizados'),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
