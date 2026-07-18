import 'package:flutter/material.dart';

class UsersEmptyState extends StatelessWidget {
  const UsersEmptyState({super.key, this.query = ''});

  final String query;

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
              decoration: const BoxDecoration(
                color: Color(0xFFf3f4f6),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.people_outline_rounded,
                size: 32,
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              query.isNotEmpty
                  ? 'Nada encontrado para "$query"'
                  : 'Nenhum usuário encontrado',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              query.isNotEmpty
                  ? 'Tente outra busca ou remova alguns filtros.'
                  : 'Convide alguém para começar.',
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

class UsersSkeletonRow extends StatelessWidget {
  const UsersSkeletonRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFeef0f3))),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFFeef0f3),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _bar(width: 160, height: 12),
                const SizedBox(height: 8),
                _bar(width: 120, height: 10),
                const SizedBox(height: 8),
                _bar(width: 90, height: 10),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _bar({required double width, required double height}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        color: const Color(0xFFeef0f3),
      ),
    );
  }
}
