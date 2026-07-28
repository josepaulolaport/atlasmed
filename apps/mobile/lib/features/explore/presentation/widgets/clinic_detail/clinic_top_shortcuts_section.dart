import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_cadastro_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_admin_info_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_registration_documents_screen.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/providers/nao_conformidade_provider.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/screens/my_suggestions_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Shortcut cards — Cadastro, Dados administrativos, and Não Conformidades.
class ClinicTopShortcutsSection extends ConsumerWidget {
  const ClinicTopShortcutsSection({
    super.key,
    required this.facilityId,
    required this.facilityName,
    required this.detail,
  });

  final String facilityId;
  final String facilityName;
  final Facility detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cadastroAsync = ref.watch(facilityCadastroProvider(facilityId));
    final pendingDocs = cadastroAsync.when(
      data: (c) => c.pendingAction,
      loading: () => null,
      error: (_, _) => null,
    );
    final adminPending = _adminInfoPendingCount(detail);
    final mySuggestionsAsync = ref.watch(
      mySuggestionsForClinicProvider(detail.id),
    );
    final pendingSuggestions = mySuggestionsAsync.maybeWhen(
      data: (items) =>
          items.where((s) => s.status == NaoConformidadeStatus.pending).length,
      orElse: () => 0,
    );

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Column(
        children: [
          _ShortcutCard(
            icon: Icons.assignment_outlined,
            title: 'Cadastro',
            badge: switch (pendingDocs) {
              null => const _ShortcutBadge.neutral('…'),
              final count => _pendingCountBadge(count, 'Completo'),
            },
            onTap: () async {
              await Navigator.of(context).push<void>(
                MaterialPageRoute(
                  builder: (_) => ClinicRegistrationDocumentsScreen(
                    facilityId: facilityId,
                    facilityName: facilityName,
                  ),
                ),
              );
              ref.invalidate(facilityCadastroProvider(facilityId));
            },
          ),
          const SizedBox(height: 8),
          _ShortcutCard(
            icon: Icons.admin_panel_settings_outlined,
            title: 'Dados administrativos',
            badge: _pendingCountBadge(adminPending, 'Completo'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ClinicAdminInfoScreen(detail: detail),
              ),
            ),
          ),
          const SizedBox(height: 8),
          _ShortcutCard(
            icon: Icons.rate_review_outlined,
            title: 'Não Conformidades',
            badge: _pendingCountBadge(pendingSuggestions, 'Em dia'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => MySuggestionsScreen.clinic(
                  targetId: detail.id,
                  targetName: detail.name,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

_ShortcutBadge _pendingCountBadge(int count, String completeLabel) =>
    switch (count) {
      0 => _ShortcutBadge.complete(completeLabel),
      final n => _ShortcutBadge.pending('$n pendente${n == 1 ? '' : 's'}'),
    };

int _adminInfoPendingCount(Facility detail) {
  bool empty(String? v) => v == null || v.trim().isEmpty;
  final hasTaxId =
      (detail.registration?.cnpj?.trim().isNotEmpty ?? false) ||
      (detail.registration?.cpf?.trim().isNotEmpty ?? false);
  final fields = <bool>[
    empty(detail.registration?.taxIdType),
    !hasTaxId,
    empty(detail.contact?.phone),
    empty(detail.contact?.whatsapp),
    empty(detail.contact?.email),
    empty(detail.contact?.website),
    empty(detail.registration?.responsiblePerson),
    empty(detail.registration?.openingHours),
    empty(detail.address?.state),
    empty(detail.address?.city),
    empty(detail.address?.postalCode),
    empty(detail.address?.composedAddressLine),
  ];
  return fields.where((isEmpty) => isEmpty).length;
}

class _ShortcutCard extends StatelessWidget {
  const _ShortcutCard({
    required this.icon,
    required this.title,
    required this.badge,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final _ShortcutBadge badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: .antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.white,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: AppColors.navyBright.createSecondary(),
                  child: Icon(icon, size: 16, color: AppColors.navyBright),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray900,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                badge,
                const SizedBox(width: 6),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
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

class _ShortcutBadge extends StatelessWidget {
  const _ShortcutBadge.complete(this.label) : _tone = _BadgeTone.complete;

  const _ShortcutBadge.pending(this.label) : _tone = _BadgeTone.pending;

  const _ShortcutBadge.neutral(this.label) : _tone = _BadgeTone.neutral;

  final String label;
  final _BadgeTone _tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (_tone) {
      _BadgeTone.complete => (AppColors.green50, AppColors.greenDark),
      _BadgeTone.pending => (AppColors.amber50, AppColors.amber),
      _BadgeTone.neutral => (AppColors.gray100, AppColors.gray400),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }
}

enum _BadgeTone { complete, pending, neutral }
