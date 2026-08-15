import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// The footer every filter surface ends with: clear on the left, apply on the
/// right, carrying how many things are selected.
///
/// Extracted because there were two, and they did not match. Explorar's was a
/// navy `Aplicar (3)` beside an outlined `Limpar`; Desempenho's was a
/// full-width button in the theme's muted primary, with its own `Limpar` as a
/// text link up in the header — far from the thing it clears, and appearing
/// only once something was selected, which pushed the whole list down on the
/// first tick.
///
/// Two filter sheets in one app should not be told apart by their buttons.
class FilterSheetFooter extends StatelessWidget {
  const FilterSheetFooter({
    super.key,
    required this.selectedCount,
    required this.onClear,
    required this.onApply,
  });

  /// Shown on the apply button. Zero hides the suffix rather than printing
  /// "(0)" — no filters is the resting state, not a quantity.
  final int selectedCount;

  /// Null disables the control: nothing selected is nothing to clear.
  final VoidCallback? onClear;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    final canClear = onClear != null && selectedCount > 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: canClear ? onClear : null,
              child: Container(
                height: 46,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.gray200),
                  color: Colors.white,
                ),
                child: Center(
                  child: Text(
                    'Limpar',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      // Greyed rather than hidden: a control that vanishes
                      // takes its own space with it and moves everything above.
                      color: canClear ? AppColors.gray700 : AppColors.gray300,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: GestureDetector(
              onTap: onApply,
              child: Container(
                height: 46,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: AppColors.navyBright,
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x4D1e40af),
                      blurRadius: 12,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    'Aplicar${selectedCount > 0 ? ' ($selectedCount)' : ''}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
