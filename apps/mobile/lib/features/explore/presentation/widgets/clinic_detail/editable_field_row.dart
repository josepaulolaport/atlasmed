import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_suggestion_sheet.dart';

/// Shared label/value row with a trailing pencil that opens the suggestion
/// sheet. Used by "Informações administrativas" and the médico personal
/// fields (Formação, Aniversário, Time, Interesses).
class EditableFieldRow extends StatelessWidget {
  const EditableFieldRow({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.emptyActionLabel = '+ Completar',
    this.labelWidth = 84,
  });

  final String label;
  final String? value;
  final IconData? icon;
  final String emptyActionLabel;
  final double labelWidth;

  bool get _isEmpty => value == null || value!.trim().isEmpty;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 15, color: const Color(0xFF9ca3af)),
            const SizedBox(width: 8),
          ],
          SizedBox(
            width: labelWidth,
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
          Expanded(
            child: _isEmpty
                ? _EmptyValueChip(
                    label: emptyActionLabel,
                    onTap: () => showEditSuggestionSheet(
                      context,
                      fieldLabel: label,
                      currentValue: null,
                    ),
                  )
                : Text(
                    value!,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF0f1729),
                    ),
                  ),
          ),
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => showEditSuggestionSheet(
              context,
              fieldLabel: label,
              currentValue: value,
            ),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(
                Icons.edit_outlined,
                size: 14,
                color: Color(0xFFb0b7c3),
              ),
            ),
          ),
        ],
      ),
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
