import 'package:atlasmed_mobile_app/features/explore/presentation/tax_identifier.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Banner on a clinic whose CPF is missing or wrong.
///
/// Reads `legalDocumentType` / `legalDocument` straight off the detail
/// response, which already carries both — no extra request, and it paints with
/// the rest of the header rather than arriving late.
///
/// Tapping opens *dados administrativos*, where `legalDocument` is an existing
/// suggestable field. The warning does not edit anything itself: a clinic's
/// identity changes through the suggestion queue, and a second path that wrote
/// directly would bypass the review that exists for it.
class ClinicCpfWarning extends StatelessWidget {
  const ClinicCpfWarning({
    super.key,
    required this.legalDocumentType,
    required this.legalDocument,
    this.onOpenAdminInfo,
  });

  final String? legalDocumentType;
  final String? legalDocument;
  final VoidCallback? onOpenAdminInfo;

  @override
  Widget build(BuildContext context) {
    final issue = cpfIssueFor(
      legalDocumentType: legalDocumentType,
      legalDocument: legalDocument,
    );
    if (issue == null) return const SizedBox.shrink();

    final (title, detail) = switch (issue) {
      CpfIssue.missing => (
        'CPF não cadastrado',
        'Esta clínica é pessoa física e ainda não tem CPF registrado.',
      ),
      CpfIssue.invalid => (
        'CPF inválido',
        'O CPF registrado não passa na verificação dos dígitos.',
      ),
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Material(
        color: AppColors.amber50,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onOpenAdminInfo,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  size: 18,
                  color: AppColors.amberDark,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.amberDark,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        detail,
                        style: const TextStyle(
                          fontSize: 12.5,
                          height: 1.3,
                          color: AppColors.gray700,
                        ),
                      ),
                      if (onOpenAdminInfo != null) ...[
                        const SizedBox(height: 6),
                        const Text(
                          'Informar em Dados administrativos',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.navyBright,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (onOpenAdminInfo != null)
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 20,
                    color: AppColors.gray400,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
