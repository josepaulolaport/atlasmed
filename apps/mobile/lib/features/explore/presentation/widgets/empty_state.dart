import 'package:flutter/material.dart';

class EmptyState extends StatelessWidget {
  final String query;
  final String kind; // 'clinic' or 'doctor'

  const EmptyState({
    super.key,
    required this.query,
    required this.kind,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 60),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(0xFFf3f4f6),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.search_off_rounded,
                size: 32,
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              query.isNotEmpty
                  ? 'Nada encontrado para "$query"'
                  : 'Nenhum resultado',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              query.isNotEmpty
                  ? 'Tente outra busca ou remova alguns filtros para ampliar o resultado.'
                  : 'Nenhum${kind == 'doctor' ? ' médico' : 'a clínica'} encontrado${kind == 'doctor' ? '' : 'a'} na sua região.',
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
