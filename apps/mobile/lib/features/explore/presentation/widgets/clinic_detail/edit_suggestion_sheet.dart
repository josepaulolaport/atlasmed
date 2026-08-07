import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/field_suggestion_mapper.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/providers/nao_conformidade_provider.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Shared bottom sheet for the "tap a pencil, suggest an edit" pattern.
Future<void> showEditSuggestionSheet(
  BuildContext context, {
  required String fieldLabel,
  required String? currentValue,
  WidgetRef? ref,
  NaoConformidadeTargetType? targetType,
  int? targetId,
  String? targetName,
  String? facilityName,
  String? fieldKey,
}) async {
  await Future<void>.delayed(Duration.zero);
  if (!context.mounted) return;

  final messenger = ScaffoldMessenger.maybeOf(context);
  final submittedValue = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      return _EditSuggestionSheetBody(
        fieldLabel: fieldLabel,
        currentValue: currentValue,
      );
    },
  );

  if (submittedValue == null || !context.mounted) return;

  if (ref == null ||
      targetType != NaoConformidadeTargetType.clinic ||
      targetId == null) {
    messenger?.showSnackBar(
      const SnackBar(
        content: Text('Sugestão enviada para revisão'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    return;
  }

  final resolvedKey = fieldKey ?? fieldKeyForLabel(fieldLabel);
  if (resolvedKey == null) {
    messenger?.showSnackBar(
      SnackBar(
        content: Text('Campo "$fieldLabel" ainda não pode ser sugerido'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    return;
  }

  try {
    await ref
        .read(naoConformidadeActionsProvider)
        .submitFieldChange(
          facilityId: targetId,
          fieldKey: resolvedKey,
          proposedValue: submittedValue.trim(),
        );
    if (!context.mounted) return;
    messenger?.showSnackBar(
      const SnackBar(
        content: Text('Sugestão enviada para revisão'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    messenger?.showSnackBar(
      SnackBar(
        content: Text('Falha ao enviar sugestão: $e'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _EditSuggestionSheetBody extends StatefulWidget {
  const _EditSuggestionSheetBody({
    required this.fieldLabel,
    required this.currentValue,
  });

  final String fieldLabel;
  final String? currentValue;

  @override
  State<_EditSuggestionSheetBody> createState() =>
      _EditSuggestionSheetBodyState();
}

class _EditSuggestionSheetBodyState extends State<_EditSuggestionSheetBody> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.currentValue ?? '');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppColors.gray200,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const Text(
            'Sugerir alteração',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            widget.fieldLabel.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: AppColors.gray400,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            autofocus: true,
            maxLines: 3,
            minLines: 1,
            decoration: InputDecoration(
              hintText: 'Novo valor para ${widget.fieldLabel}',
              filled: true,
              fillColor: AppColors.surfaceTertiary,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Sua sugestão passa por revisão administrativa antes de entrar no perfil.',
            style: TextStyle(fontSize: 11.5, color: AppColors.gray400),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () {
                final value = _controller.text.trim();
                if (value.isEmpty) return;
                Navigator.of(context).pop(value);
              },
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.navyBright,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Enviar sugestão'),
            ),
          ),
        ],
      ),
    );
  }
}
