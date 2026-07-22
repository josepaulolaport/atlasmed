import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_suggestion_sheet.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';

/// Optional context so a submitted suggestion lands in the Não Conformidades
/// queue and on “Não Conformidades” for this profile.
class EditSuggestionTarget {
  const EditSuggestionTarget({
    required this.type,
    required this.id,
    required this.name,
    this.facilityName,
  });

  final NaoConformidadeTargetType type;
  final String id;
  final String name;
  final String? facilityName;
}

/// Field block with label above value. Tap copies when a value is present;
/// the pencil opens the suggest-edit sheet (or [onEdit] when provided).
class EditableFieldRow extends ConsumerWidget {
  const EditableFieldRow({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.emptyActionLabel = '+ Completar',
    this.showDivider = true,
    this.onEdit,
    this.suggestionTarget,
    this.fieldKey,
    this.showEditButton = true,
  });

  final String label;
  final String? value;
  final IconData? icon;
  final String emptyActionLabel;

  /// Soft hairline under the field (omit on the last row in a card).
  final bool showDivider;

  /// Custom edit action (e.g. multi-field address sheet). Falls back to the
  /// single-field suggestion sheet when null.
  final VoidCallback? onEdit;

  final EditSuggestionTarget? suggestionTarget;

  /// API `fieldKey` when known; otherwise derived from [label].
  final String? fieldKey;

  /// When false, hides the pencil and empty-field "+ Completar" suggest affordance.
  final bool showEditButton;

  bool get _isEmpty => value == null || value!.trim().isEmpty;

  Future<void> _copy(BuildContext context) async {
    final text = value?.trim();
    if (text == null || text.isEmpty) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    await Clipboard.setData(ClipboardData(text: text));
    messenger?.showSnackBar(
      SnackBar(
        content: Text('$label copiado'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _suggestEdit(BuildContext context, WidgetRef ref) {
    final customEdit = onEdit;
    final label = this.label;
    final value = this.value;
    final target = suggestionTarget;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!context.mounted) return;
      if (customEdit != null) {
        customEdit();
        return;
      }
      showEditSuggestionSheet(
        context,
        fieldLabel: label,
        currentValue: value,
        ref: target == null ? null : ref,
        targetType: target?.type,
        targetId: target?.id,
        targetName: target?.name,
        facilityName: target?.facilityName,
        fieldKey: fieldKey,
      );
    });
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: _isEmpty
                ? (showEditButton ? () => _suggestEdit(context, ref) : null)
                : () => _copy(context),
            splashColor: const Color(0xFF1e40af).withValues(alpha: 0.08),
            highlightColor: const Color(0xFF1e40af).withValues(alpha: 0.05),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (icon != null) ...[
                        Icon(icon, size: 15, color: const Color(0xFF9ca3af)),
                        const SizedBox(width: 8),
                      ],
                      Expanded(
                        child: Text(
                          label.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                            color: Color(0xFF9ca3af),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(
                            left: icon != null ? 23 : 0,
                            top: 8,
                          ),
                          child: _isEmpty
                              ? (showEditButton
                                    ? _EmptyValueChip(
                                        label: emptyActionLabel,
                                        onTap: () =>
                                            _suggestEdit(context, ref),
                                      )
                                    : const Text(
                                        '—',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500,
                                          color: Color(0xFF9ca3af),
                                        ),
                                      ))
                              : Text(
                                  value!,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    height: 1.35,
                                    color: Color(0xFF0f1729),
                                  ),
                                ),
                        ),
                      ),
                      if (showEditButton)
                        IconButton(
                          onPressed: () => _suggestEdit(context, ref),
                          icon: const Icon(
                            Icons.edit_outlined,
                            size: 18,
                            color: Color(0xFF6b7280),
                          ),
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(
                            minWidth: 40,
                            minHeight: 40,
                          ),
                          splashRadius: 20,
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        if (showDivider)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Divider(height: 1, thickness: 1, color: Color(0xFFf3f4f6)),
          ),
      ],
    );
  }
}

class _EmptyValueChip extends StatelessWidget {
  const _EmptyValueChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFfef3d5),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: const Color(0xFFc6861b).withValues(alpha: 0.3),
          ),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFFc6861b),
          ),
        ),
      ),
    );
  }
}
