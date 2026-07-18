import 'package:flutter/material.dart';

class EmptyState extends StatelessWidget {
  /// Explore tabs: `'clinic'` | `'doctor'`.
  /// Facility Ver todos: `'facility-doctor'` | `'facility-admin'`.
  final String query;
  final String kind;

  const EmptyState({super.key, required this.query, required this.kind});

  @override
  Widget build(BuildContext context) {
    final title = query.isNotEmpty
        ? 'Nada encontrado para "$query"'
        : switch (kind) {
            'facility-doctor' => 'Nenhum médico associado',
            'facility-admin' => 'Nenhum profissional associado',
            _ => 'Nenhum resultado',
          };

    final subtitle = query.isNotEmpty
        ? 'Tente outra busca ou remova alguns filtros para ampliar o resultado.'
        : switch (kind) {
            'facility-doctor' =>
              'Toque em + no canto inferior para buscar e associar médicos a esta clínica.',
            'facility-admin' =>
              'Toque em + no canto inferior para buscar e associar profissionais a esta clínica.',
            'doctor' => 'Nenhum médico encontrado na sua região.',
            _ => 'Nenhuma clínica encontrada na sua região.',
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
                color: Color(0xFFf3f4f6),
                shape: BoxShape.circle,
              ),
              child: Icon(
                query.isNotEmpty
                    ? Icons.search_off_rounded
                    : Icons.person_off_outlined,
                size: 32,
                color: const Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF6b7280),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
