import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class EmptyState extends StatelessWidget {
  /// Explore tabs: `'clinic'` | `'doctor'`.
  /// Facility Ver todos: `'facility-doctor'` | `'facility-admin'`.
  final String query;
  final String kind;
  final bool hasActiveFilters;
  final VoidCallback? onClearFilters;

  const EmptyState({
    super.key,
    required this.query,
    required this.kind,
    this.hasActiveFilters = false,
    this.onClearFilters,
  });

  @override
  Widget build(BuildContext context) {
    final constrained = query.trim().isNotEmpty || hasActiveFilters;
    final title = query.isNotEmpty
        ? 'Nada encontrado para "$query"'
        : hasActiveFilters
        ? 'Nenhum resultado com estes filtros'
        : switch (kind) {
            'facility-doctor' => 'Nenhum médico associado',
            'facility-admin' => 'Nenhum profissional associado',
            _ => 'Nenhum resultado',
          };

    final subtitle = constrained
        ? 'Tente outra busca ou limpe os filtros para ampliar os resultados.'
        : switch (kind) {
            'facility-doctor' =>
              'Toque em + no canto inferior para buscar e associar médicos a esta clínica.',
            'facility-admin' =>
              'Toque em + no canto inferior para buscar e associar profissionais a esta clínica.',
            'doctor' => 'Nenhum médico encontrado.',
            _ => 'Nenhuma clínica encontrada.',
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
              child: Icon(
                query.isNotEmpty
                    ? Icons.search_off_rounded
                    : Icons.person_off_outlined,
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
          ],
        ),
      ),
    );
  }
}
