import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_suggestion_sheet.dart';

/// Field block with label above value. Tap copies when a value is present;
/// the pencil opens the suggest-edit sheet.
class EditableFieldRow extends StatelessWidget {
  const EditableFieldRow({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.emptyActionLabel = '+ Completar',
    this.showDivider = true,
  });

  final String label;
  final String? value;
  final IconData? icon;
  final String emptyActionLabel;

  /// Soft hairline under the field (omit on the last row in a card).
  final bool showDivider;

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

  void _suggestEdit(BuildContext context) {
    final label = this.label;
    final value = this.value;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!context.mounted) return;
      showEditSuggestionSheet(
        context,
        fieldLabel: label,
        currentValue: value,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: _isEmpty
                ? () => _suggestEdit(context)
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
                              ? _EmptyValueChip(
                                  label: emptyActionLabel,
                                  onTap: () => _suggestEdit(context),
                                )
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
                      IconButton(
                        onPressed: () => _suggestEdit(context),
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
