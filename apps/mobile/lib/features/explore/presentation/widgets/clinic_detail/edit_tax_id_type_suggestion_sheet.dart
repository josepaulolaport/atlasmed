import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Suggestion sheet to propose PF vs PJ for a facility.
///
/// Phase 1: confirmation snackbar only. Phase 2 wires to the field-suggestion
/// review pipeline (`FACILITY_FIELD_UPDATE`).
Future<void> showTaxIdTypeSuggestionSheet(
  BuildContext context, {
  required String? currentTaxIdType,
}) async {
  await Future<void>.delayed(Duration.zero);
  if (!context.mounted) return;

  final messenger = ScaffoldMessenger.maybeOf(context);
  final submitted = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _TaxIdTypeSuggestionSheetBody(
      currentTaxIdType: parseFacilityTaxIdType(currentTaxIdType),
    ),
  );

  if (submitted == true && messenger != null) {
    messenger.showSnackBar(
      const SnackBar(
        content: Text('Sugestão enviada para revisão'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _TaxIdTypeSuggestionSheetBody extends StatefulWidget {
  const _TaxIdTypeSuggestionSheetBody({required this.currentTaxIdType});

  final FacilityTaxIdType? currentTaxIdType;

  @override
  State<_TaxIdTypeSuggestionSheetBody> createState() =>
      _TaxIdTypeSuggestionSheetBodyState();
}

class _TaxIdTypeSuggestionSheetBodyState
    extends State<_TaxIdTypeSuggestionSheetBody> {
  late FacilityTaxIdType? _selected = widget.currentTaxIdType;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFe5e7eb),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const Text(
            'Sugerir tipo do estabelecimento',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Pessoa Física (PF) ou Pessoa Jurídica (PJ). A alteração '
            'passa por revisão administrativa antes de valer no cadastro.',
            style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _TypeChip(
                  label: 'Pessoa Física (PF)',
                  icon: Icons.person_rounded,
                  selected: _selected == FacilityTaxIdType.pf,
                  onTap: () => setState(() => _selected = FacilityTaxIdType.pf),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _TypeChip(
                  label: 'Pessoa Jurídica (PJ)',
                  icon: Icons.apartment_rounded,
                  selected: _selected == FacilityTaxIdType.pj,
                  onTap: () => setState(() => _selected = FacilityTaxIdType.pj),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _selected == null
                  ? null
                  : () => Navigator.of(context).pop(true),
              style: FilledButton.styleFrom(
                backgroundColor: const AppColors.navyBright,
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

class _TypeChip extends StatelessWidget {
  const _TypeChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFdbeafe) : const Color(0xFFf8f9fb),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected
                  ? const AppColors.navyBright
                  : const Color(0xFFe5e7eb),
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                size: 22,
                color: selected
                    ? const AppColors.navyBright
                    : const AppColors.gray500,
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: selected
                      ? const AppColors.navyBright
                      : const Color(0xFF4b5563),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
