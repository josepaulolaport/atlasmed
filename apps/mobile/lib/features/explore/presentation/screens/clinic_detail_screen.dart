import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/establishment_detail_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/administrative_professionals_list_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_admin_professionals_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_context_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_crm_doctors_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_field_notes_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_header_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_location_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_orders_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_payers_bar_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_section_header.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_top_shortcuts_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/doctors_list_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_payer_sources_screen.dart';

// ===============================================================
// ClinicDetailScreen — establishment detail, per Spec 0005 redesign
// ===============================================================
class ClinicDetailScreen extends ConsumerWidget {
  final String clinicId;

  const ClinicDetailScreen({super.key, required this.clinicId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(clinicDetailProvider(clinicId));

    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      body: detailAsync.when(
        loading: () => _loadingSkeleton(context),
        error: (err, _) => _errorView(context, ref, clinicId, err),
        data: (detail) => _ClinicDetailBody(detail: detail, clinicId: clinicId),
      ),
    );
  }

  Widget _loadingSkeleton(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          _buildHeaderShimmer(context),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: List.generate(
                6,
                (_) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: _ShimmerBlock(height: 100),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderShimmer(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Container(
      height: 180 + top,
      decoration: const BoxDecoration(
        color: Color(0xFF1e40af),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      child: const Center(
        child: CircularProgressIndicator(color: Colors.white),
      ),
    );
  }

  Widget _errorView(
    BuildContext context,
    WidgetRef ref,
    String clinicId,
    Object error,
  ) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.wifi_off_rounded,
                size: 48,
                color: Color(0xFFb84545),
              ),
              const SizedBox(height: 16),
              const Text(
                'Não foi possível carregar o estabelecimento',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0f1729),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _friendlyLoadError(error),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF6b7280), height: 1.4),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => ref.invalidate(clinicDetailProvider(clinicId)),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Tentar novamente'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => context.pop(),
                child: const Text('Voltar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _friendlyLoadError(Object error) {
  final raw = error.toString().toLowerCase();
  if (raw.contains('socket') ||
      raw.contains('network') ||
      raw.contains('failed host lookup') ||
      raw.contains('connection') ||
      raw.contains('timeout') ||
      raw.contains('timed out') ||
      raw.contains('unreachable')) {
    return 'Verifique sua conexão com a internet e tente novamente.';
  }
  if (raw.contains('not found') || raw.contains('404')) {
    return 'Este estabelecimento não foi encontrado ou não está disponível.';
  }
  if (raw.contains('401') ||
      raw.contains('403') ||
      raw.contains('unauthorized') ||
      raw.contains('forbidden')) {
    return 'Sua sessão expirou ou você não tem permissão. Faça login novamente.';
  }
  return 'Algo deu errado ao buscar os dados. Tente novamente em instantes.';
}

Future<void> _openPayerSourcesEditor(
  BuildContext context,
  WidgetRef ref, {
  required String clinicId,
  required String facilityName,
  required List<PayerShare> payers,
}) async {
  final updated = await Navigator.of(context).push<List<PayerShare>>(
    MaterialPageRoute(
      builder: (_) => EditPayerSourcesScreen(
        facilityName: facilityName,
        initialPayers: payers,
      ),
    ),
  );
  if (updated == null || !context.mounted) return;
  ref.read(facilityPayersOverrideProvider(clinicId).notifier).state = updated;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(
        updated.isEmpty
            ? 'Fontes pagadoras removidas'
            : 'Fontes pagadoras atualizadas',
      ),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

// ===============================================================
// Body — fixed blue header (outside the scroll) + scrollable sections
// ===============================================================
class _ClinicDetailBody extends ConsumerWidget {
  const _ClinicDetailBody({required this.detail, required this.clinicId});

  final ClinicDetail detail;
  final String clinicId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sections = ref
        .watch(establishmentDetailSectionsProvider(clinicId))
        .valueOrNull;

    return Column(
      children: [
        ClinicHeaderSection(detail: detail, sections: sections),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(clinicDetailProvider(clinicId));
              ref.invalidate(establishmentDetailSectionsProvider(clinicId));
              ref.invalidate(clinicVisitsProvider(clinicId));
              await Future.wait([
                ref.read(clinicDetailProvider(clinicId).future),
                ref.read(establishmentDetailSectionsProvider(clinicId).future),
              ]);
            },
            child: _ClinicDetailContent(detail: detail, clinicId: clinicId),
          ),
        ),
      ],
    );
  }
}

// ===============================================================
// Scrollable content body — section order per Spec 0005 redesign
// ===============================================================
class _ClinicDetailContent extends ConsumerWidget {
  final ClinicDetail detail;
  final String clinicId;

  const _ClinicDetailContent({required this.detail, required this.clinicId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sectionsAsync = ref.watch(
      establishmentDetailSectionsProvider(clinicId),
    );

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.only(top: 16, bottom: 32),
      children: [
        _QuickActions(detail: detail),
        ClinicTopShortcutsSection(
          facilityName: detail.name,
          detail: detail,
          // null while sections are still loading — badge stays neutral
          // instead of flashing a false "Completo".
          documents: sectionsAsync.valueOrNull?.documents,
        ),
        const ClinicSectionHeader(title: 'Mapa e clínicas próximas'),
        sectionsAsync.when(
          loading: () => const _SectionLoadingCard(),
          error: (err, _) => _SectionErrorCard(
            message: _friendlyLoadError(err),
            onRetry: () =>
                ref.invalidate(establishmentDetailSectionsProvider(clinicId)),
          ),
          data: (sections) {
            if (sections.location == null) {
              return const ClinicDetailCard(
                child: Text(
                  'Localização não disponível para este estabelecimento',
                  style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
                ),
              );
            }
            return ClinicLocationSection(
              facilityId: clinicId,
              facilityName: detail.name,
              location: sections.location!,
              nearbyEstablishments: sections.nearbyEstablishments,
            );
          },
        ),
        sectionsAsync.when(
          loading: () =>
              const ClinicSectionHeader(title: 'Profissionais administrativos'),
          error: (_, _) =>
              const ClinicSectionHeader(title: 'Profissionais administrativos'),
          data: (sections) => ClinicSectionHeader(
            title: 'Profissionais administrativos',
            badge: sections.administrators.isEmpty
                ? null
                : _CountBadge(count: sections.administrators.length),
            trailing: _HeaderLinkButton(
              label: 'Ver todos',
              icon: Icons.chevron_right_rounded,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => AdministrativeProfessionalsListScreen(
                    professionals: sections.administrators,
                    facilityName: detail.name,
                  ),
                ),
              ),
            ),
          ),
        ),
        sectionsAsync.when(
          loading: () => const _SectionLoadingCard(),
          error: (err, _) => _SectionErrorCard(
            message: _friendlyLoadError(err),
            onRetry: () =>
                ref.invalidate(establishmentDetailSectionsProvider(clinicId)),
          ),
          data: (sections) => ClinicAdminProfessionalsSection(
            professionals: sections.administrators,
            facilityName: detail.name,
            onAssociate: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => AdministrativeProfessionalsListScreen(
                  professionals: sections.administrators,
                  facilityName: detail.name,
                ),
              ),
            ),
          ),
        ),
        sectionsAsync.when(
          loading: () => const ClinicSectionHeader(title: 'Médicos'),
          error: (_, _) => const ClinicSectionHeader(title: 'Médicos'),
          data: (sections) => ClinicSectionHeader(
            title: 'Médicos',
            badge: sections.doctors.isEmpty
                ? null
                : _CountBadge(count: sections.doctors.length),
            trailing: _HeaderLinkButton(
              label: 'Ver todos',
              icon: Icons.chevron_right_rounded,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => DoctorsListScreen(
                    doctors: sections.doctors,
                    facilityName: detail.name,
                  ),
                ),
              ),
            ),
          ),
        ),
        sectionsAsync.when(
          loading: () => const _SectionLoadingCard(),
          error: (err, _) => _SectionErrorCard(
            message: _friendlyLoadError(err),
            onRetry: () =>
                ref.invalidate(establishmentDetailSectionsProvider(clinicId)),
          ),
          data: (sections) => ClinicCrmDoctorsSection(
            doctors: sections.doctors,
            onAssociate: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => DoctorsListScreen(
                  doctors: sections.doctors,
                  facilityName: detail.name,
                ),
              ),
            ),
          ),
        ),
        sectionsAsync.when(
          loading: () => const ClinicSectionHeader(title: 'Fontes Pagadoras'),
          error: (_, _) => const ClinicSectionHeader(title: 'Fontes Pagadoras'),
          data: (sections) {
            final payers =
                ref.watch(facilityPayersOverrideProvider(clinicId)) ??
                sections.payers;
            return ClinicSectionHeader(
              title: 'Fontes Pagadoras',
              trailing: _HeaderLinkButton(
                label: 'Editar',
                onTap: () => _openPayerSourcesEditor(
                  context,
                  ref,
                  clinicId: clinicId,
                  facilityName: detail.name,
                  payers: payers,
                ),
              ),
            );
          },
        ),
        sectionsAsync.when(
          loading: () => const _SectionLoadingCard(),
          error: (err, _) => _SectionErrorCard(
            message: _friendlyLoadError(err),
            onRetry: () =>
                ref.invalidate(establishmentDetailSectionsProvider(clinicId)),
          ),
          data: (sections) {
            final override = ref.watch(
              facilityPayersOverrideProvider(clinicId),
            );
            final payers = override ?? sections.payers;
            final summary = override != null
                ? buildPayerMixSummary(payers)
                : sections.payerMixSummary;
            return ClinicPayersBarSection(
              payers: payers,
              summary: summary,
              onEdit: () => _openPayerSourcesEditor(
                context,
                ref,
                clinicId: clinicId,
                facilityName: detail.name,
                payers: payers,
              ),
            );
          },
        ),
        sectionsAsync.when(
          loading: () => const ClinicSectionHeader(title: 'Pedidos recentes'),
          error: (_, _) => const ClinicSectionHeader(title: 'Pedidos recentes'),
          data: (sections) => ClinicSectionHeader(
            title: 'Pedidos recentes',
            badge: sections.orders.isEmpty
                ? null
                : _CountBadge(count: sections.orders.length),
            trailing: sections.orders.isEmpty
                ? null
                : _HeaderLinkButton(
                    label: 'Ver todos',
                    icon: Icons.chevron_right_rounded,
                    onTap: () => context.push('/pedidos'),
                  ),
          ),
        ),
        sectionsAsync.when(
          loading: () => const _SectionLoadingCard(),
          error: (err, _) => _SectionErrorCard(
            message: _friendlyLoadError(err),
            onRetry: () =>
                ref.invalidate(establishmentDetailSectionsProvider(clinicId)),
          ),
          data: (sections) => ClinicOrdersSection(
            orders: sections.orders,
            facilityId: clinicId,
          ),
        ),
        const ClinicSectionHeader(title: 'Notas de campo'),
        sectionsAsync.when(
          loading: () => const _SectionLoadingCard(),
          error: (err, _) => _SectionErrorCard(
            message: _friendlyLoadError(err),
            onRetry: () =>
                ref.invalidate(establishmentDetailSectionsProvider(clinicId)),
          ),
          data: (sections) =>
              ClinicFieldNotesSection(initialNotes: sections.fieldNotes),
        ),
        const ClinicSectionHeader(title: 'Consultor responsável'),
        sectionsAsync.when(
          loading: () => const _SectionLoadingCard(),
          error: (err, _) => _SectionErrorCard(
            message: _friendlyLoadError(err),
            onRetry: () =>
                ref.invalidate(establishmentDetailSectionsProvider(clinicId)),
          ),
          data: (sections) => ClinicContextSection(
            consultantName: sections.consultantName ?? detail.consultantName,
            consultantSince: sections.consultantSince,
            regionZoneLabel: sections.regionZoneLabel,
            city: detail.city.isNotEmpty ? detail.city : null,
          ),
        ),
        const _SuggestEditBanner(),
      ],
    );
  }
}

class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFeef4ff),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        '$count',
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: Color(0xFF1e40af),
        ),
      ),
    );
  }
}

/// Shared header trailing action — used for every "Ver todos"/"Editar" link
/// so all section headers position their action identically relative to
/// the title (single `InkWell` + tight padding, no button min-size/padding
/// quirks that would shift it out of alignment with the others).
class _HeaderLinkButton extends StatelessWidget {
  const _HeaderLinkButton({
    required this.label,
    this.icon,
    required this.onTap,
  });

  final String label;
  final IconData? icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1e40af),
              ),
            ),
            if (icon != null)
              Icon(icon, size: 16, color: const Color(0xFF1e40af)),
          ],
        ),
      ),
    );
  }
}

class _SectionLoadingCard extends StatelessWidget {
  const _SectionLoadingCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      height: 80,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}

class _SectionErrorCard extends StatelessWidget {
  const _SectionErrorCard({required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFfde8e8),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message,
            style: const TextStyle(
              fontSize: 12.5,
              color: Color(0xFFb84545),
              height: 1.4,
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 10),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Tentar novamente'),
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFFb84545),
                padding: EdgeInsets.zero,
                visualDensity: VisualDensity.compact,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ===============================================================
// QuickActions — Ligar, WhatsApp, Rota, Nova visita, Novo pedido
// ===============================================================
class _QuickActions extends ConsumerWidget {
  final ClinicDetail detail;
  const _QuickActions({required this.detail});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 0),
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _ActionButton(
            icon: Icons.phone_rounded,
            label: 'Ligar',
            onTap: () => launchContactUrl(
              context,
              url: callUrl(detail.phone),
              contactLabel: 'telefone',
            ),
          ),
          _ActionButton(
            icon: Icons.chat_rounded,
            label: 'WhatsApp',
            onTap: () => launchContactUrl(
              context,
              url: whatsappUrl(detail.phone),
              contactLabel: 'WhatsApp',
            ),
          ),
          _ActionButton(
            icon: Icons.directions_rounded,
            label: 'Rota',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'Rota — disponível após integração de coordenadas',
                  ),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),
          _ActionButton(
            icon: Icons.calendar_month_rounded,
            label: 'Visita',
            onTap: () async {
              try {
                final repo = ref.read(
                  clinicVisitsRepositoryProvider(detail.id),
                );
                await repo.createVisit();
                ref.invalidate(clinicVisitsProvider(detail.id));
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Visita registrada com sucesso'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Erro ao registrar visita'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              }
            },
          ),
          _ActionButton(
            icon: Icons.note_add_rounded,
            label: 'Pedido',
            onTap: () => context.push('/pedidos/novo'),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(28),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFf3f4f6)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Icon(icon, size: 20, color: const Color(0xFF1e40af)),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: Color(0xFF4b5563),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ===============================================================
// SuggestEditBanner — explains the per-field pencil pattern
// ===============================================================
class _SuggestEditBanner extends StatelessWidget {
  const _SuggestEditBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFf8f9fb),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.edit_note_rounded,
            size: 18,
            color: Color(0xFF9ca3af),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Toque nos ícones em qualquer campo. Sugestões passam por '
              'revisão administrativa antes de entrar no perfil.',
              style: TextStyle(fontSize: 11.5, color: Color(0xFF6b7280)),
            ),
          ),
        ],
      ),
    );
  }
}

// ===============================================================
// NOTE: the pre-Spec-0005 detail screen widgets that used to live below
// this point (_ClinicContextCard, _ClinicSignals, _ClinicHealth,
// _ClinicProducts, _ClinicPayers, _NearbyClinics, _ClinicVisits,
// _ClinicDoctors, _ClinicNotes, _ClinicAdmin, and their row helpers) are
// superseded by the `widgets/clinic_detail/*.dart` section widgets wired
// into `_ClinicDetailContent` above (ClinicContextSection,
// ClinicAdminInfoSection, etc.) and have been removed — see git history
// for the old implementation. `ClinicAdminInfoSection` should use
// `displayTaxIdentifier` (from `tax_identifier.dart`) for its CNPJ/CPF row.
// ===============================================================
class _ShimmerBlock extends StatelessWidget {
  final double height;
  const _ShimmerBlock({required this.height});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFeef0f3),
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}
