import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// The empty state for every list in the Administração panel.
///
/// Deliberately the same shape as `EmptyState` in Explorar and
/// `UsersEmptyState` in Equipe — a 72px circle, a 16/w600 line, a 13/gray500
/// line under it — because those are what the rest of the app looks like when
/// a list has nothing in it. Every list in this panel had a bare centred
/// 12.5px gray sentence instead, which reads as a screen that failed to load
/// rather than one with nothing to show.
///
/// The two states are separated on purpose. *Nothing here yet* is an invitation
/// and should say how to add the first one; *nothing matches your search* is a
/// dead end and should offer the way out. Collapsing them into one sentence is
/// how an admin decides a catalogue is empty when they simply mistyped.
class CatalogEmptyState extends StatelessWidget {
  const CatalogEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.action,
  });

  /// The "nothing matched" variant, with the query echoed back so the admin can
  /// see what was actually searched.
  factory CatalogEmptyState.noResults({
    required String query,
    required VoidCallback onClear,
  }) {
    return CatalogEmptyState(
      icon: Icons.search_off_rounded,
      title: 'Nada encontrado para “$query”',
      subtitle: 'Tente outra busca ou limpe o campo para ver tudo.',
      action: TextButton(onPressed: onClear, child: const Text('Limpar busca')),
    );
  }

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 40),
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
              child: Icon(icon, size: 32, color: AppColors.gray400),
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
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      ),
    );
  }
}

/// The empty state for a list *inside* a form — the equivalences of a product,
/// the products of a metric. Smaller, because it sits in a section rather than
/// owning the screen, and the surrounding form already gives it context.
class CatalogInlineEmpty extends StatelessWidget {
  const CatalogInlineEmpty({super.key, required this.message, this.icon});

  final String message;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: AppColors.surfaceTertiary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: AppColors.gray400),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.gray500,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
