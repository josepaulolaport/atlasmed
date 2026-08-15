import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class EmptyState extends StatelessWidget {
  /// Explore tabs: `'clinic'` | `'doctor'`.
  /// Facility Ver todos: `'facility-doctor'` | `'facility-admin'`.
  final String query;
  final String kind;
  final bool hasActiveFilters;
  final VoidCallback? onClearFilters;

  /// Shown under the message. The clinics tab puts "Buscar no CNES" here: not
  /// finding a clinic is exactly the moment spec 0015 §6 describes.
  final Widget? footer;

  const EmptyState({
    super.key,
    required this.query,
    required this.kind,
    this.hasActiveFilters = false,
    this.onClearFilters,
    this.footer,
  });

  @override
  Widget build(BuildContext context) {
    final searching = query.trim().isNotEmpty;
    final title = searching
        ? 'Nada encontrado para "$query"'
        : hasActiveFilters
        ? 'Nenhum resultado com estes filtros'
        : switch (kind) {
            'facility-doctor' => 'Nenhum médico associado',
            'facility-admin' => 'Nenhum profissional associado',
            _ => 'Nenhum resultado',
          };

    // Only mention filters when there are filters.
    //
    // Every search used to end in "tente outra busca ou limpe os filtros",
    // including on surfaces that have no filters at all — the CNES lookup has
    // a search field and nothing else, so it asked the rep to clear something
    // that does not exist there.
    final subtitle = switch ((searching, hasActiveFilters)) {
      (true, true) =>
        'Tente outro termo ou limpe os filtros para ampliar os resultados.',
      (true, false) => 'Tente outro termo.',
      (false, true) => 'Ajuste ou limpe os filtros para ampliar os resultados.',
      (false, false) => switch (kind) {
        'facility-doctor' =>
          'Toque em + no canto inferior para buscar e associar médicos a esta clínica.',
        'facility-admin' =>
          'Toque em + no canto inferior para buscar e associar profissionais a esta clínica.',
        'doctor' => 'Nenhum médico encontrado.',
        _ => 'Nenhuma clínica encontrada.',
      },
    };

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 60),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.gray100,
                shape: BoxShape.circle,
              ),
              // `person_off` only where the missing thing is a person; a
              // clinics list with no results was showing a crossed-out person.
              child: Icon(
                searching || hasActiveFilters
                    ? Icons.search_off_rounded
                    : switch (kind) {
                        'facility-doctor' ||
                        'facility-admin' ||
                        'doctor' => Icons.person_off_outlined,
                        _ => Icons.local_hospital_outlined,
                      },
                size: 32,
                color: AppColors.gray400,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.gray500,
                height: 1.5,
              ),
            ),
            if (hasActiveFilters && onClearFilters != null) ...[
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: onClearFilters,
                child: const Text('Limpar filtros'),
              ),
            ],
            if (footer != null) ...[const SizedBox(height: 16), footer!],
          ],
        ),
      ),
    );
  }
}
