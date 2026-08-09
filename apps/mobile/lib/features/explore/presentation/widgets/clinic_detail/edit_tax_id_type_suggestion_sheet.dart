import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Suggestion sheet to propose CPF vs CNPJ for a facility.
///
/// Phase 1: confirmation snackbar only. Phase 2 wires to the field-suggestion
/// review pipeline (`FACILITY_FIELD_UPDATE`) with fieldKey `legalDocumentType`.
Future<void> showTaxIdTypeSuggestionSheet(
  BuildContext context, {
  required String? currentLegalDocumentType,
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
    builder: (_) => _LegalDocumentTypeSuggestionSheetBody(
      currentLegalDocumentType: parseFacilityLegalDocumentType(
        currentLegalDocumentType,
      ),
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

class _LegalDocumentTypeSuggestionSheetBody extends StatefulWidget {
  const _LegalDocumentTypeSuggestionSheetBody({
    required this.currentLegalDocumentType,
  });

  final FacilityLegalDocumentType? currentLegalDocumentType;

  @override
  State<_LegalDocumentTypeSuggestionSheetBody> createState() =>
      _LegalDocumentTypeSuggestionSheetBodyState();
}

class _LegalDocumentTypeSuggestionSheetBodyState
    extends State<_LegalDocumentTypeSuggestionSheetBody> {
  late FacilityLegalDocumentType? _selected = widget.currentLegalDocumentType;

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
                color: AppColors.gray200,
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
            'Pessoa Física (CPF) ou Pessoa Jurídica (CNPJ). A alteração '
            'passa por revisão administrativa antes de valer no cadastro.',
            style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _TypeChip(
                  label: 'Pessoa Física (CPF)',
                  icon: Icons.person_rounded,
                  selected: _selected == FacilityLegalDocumentType.cpf,
                  onTap: () =>
                      setState(() => _selected = FacilityLegalDocumentType.cpf),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _TypeChip(
                  label: 'Pessoa Jurídica (CNPJ)',
                  icon: Icons.apartment_rounded,
                  selected: _selected == FacilityLegalDocumentType.cnpj,
                  onTap: () => setState(
                    () => _selected = FacilityLegalDocumentType.cnpj,
                  ),
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
                backgroundColor: AppColors.navyBright,
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
      color: selected ? AppColors.blue100 : AppColors.surfaceTertiary,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.navyBright : AppColors.gray200,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                size: 22,
                color: selected ? AppColors.navyBright : AppColors.gray500,
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: selected ? AppColors.navyBright : AppColors.gray600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
