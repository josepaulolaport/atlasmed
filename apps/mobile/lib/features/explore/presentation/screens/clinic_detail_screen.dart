import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_consultant_assignments_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_consultant_assignments_provider.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/user_picker_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_zip_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/purchase_recurrence_save.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_visits_providers.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/providers/purchase_recurrence_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/quick_actions.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/administrative_professionals_list_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_admin_professionals_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_context_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_crm_doctors_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_deactivation_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_linha_bar.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_field_notes_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_header_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_location_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_payers_bar_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_potential_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_section_header.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_top_shortcuts_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/doctors_list_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_payer_sources_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/purchase_recurrence_form.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/purchase_recurrence_section.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

// ===============================================================
// ClinicDetailScreen — establishment detail, per Spec 0005 redesign
// ===============================================================
class ClinicDetailScreen extends ConsumerWidget {
  const ClinicDetailScreen({
    super.key,
    required this.clinicId,
    this.initialVerticalId,
  });

  final String clinicId;
  final String? initialVerticalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(
      clinicDetailScopeProvider((
        facilityId: clinicId,
        initialVerticalId: initialVerticalId,
      )),
    );
    final repository = ref.watch(facilityZipRepositoryProvider(clinicId));

    return Scaffold(
      backgroundColor: AppColors.navyBright,
      appBar: AppBar(
        backgroundColor: AppColors.navyBright,
        foregroundColor: Colors.white,
        systemOverlayStyle: .light,
        actions: [
          IconButton(
            icon: const Icon(Icons.bookmark_border_rounded),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Favoritos — em breve'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: RepositoryBuilder<FacilityZipRepository, FacilityDetailData>(
        repository: repository,
        builder: (context, data, repository) => _ClinicDetailContent(
          data: data,
          clinicId: clinicId,
          repository: repository,
        ),
      ),
    );
  }
}

Future<void> _openAdministratorsList(
  BuildContext context,
  FacilityZipRepository repository, {
  required String clinicId,
  required String facilityName,
  required List<AdministrativeProfessional> rosterFallback,
}) async {
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) => AdministrativeProfessionalsListScreen(
        facilityId: clinicId,
        professionals: rosterFallback,
        facilityName: facilityName,
      ),
    ),
  );
  await repository.refreshAdministrators();
}

Future<void> _openDoctorsList(
  BuildContext context,
  FacilityZipRepository repository, {
  required String clinicId,
  required String facilityName,
  required List<ProfessionalRoster> rosterFallback,
}) async {
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) => DoctorsListScreen(
        facilityId: clinicId,
        doctors: rosterFallback,
        facilityName: facilityName,
      ),
    ),
  );
  await repository.refreshDoctors();
}

Future<void> _openPayerSourcesEditor(
  BuildContext context, {
  required FacilityZipRepository repository,
  required String clinicId,
  required List<PayerShare> payers,
}) async {
  late final List<PayerCatalogEntry> catalog;
  try {
    catalog = await repository.loadPayerCatalog();
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Não foi possível carregar o catálogo de fontes pagadoras.',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
    return;
  }
  if (catalog.isEmpty) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Nenhuma fonte pagadora disponível no catálogo.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    return;
  }
  if (!context.mounted) return;

  final updated = await Navigator.of(context).push<List<PayerShare>>(
    MaterialPageRoute(
      builder: (_) =>
          EditPayerSourcesScreen(initialPayers: payers, catalog: catalog),
    ),
  );
  if (updated == null || !context.mounted) return;

  try {
    await repository.replacePayerShares(updated);
    if (!context.mounted) return;
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
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Não foi possível salvar as fontes pagadoras.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

Future<void> _openPurchaseRecurrenceEditor(
  BuildContext context,
  WidgetRef ref,
  Facility detail,
) async {
  final profiles = detail.verticalProfiles;
  final verticalId =
      ref.read(clinicDetailActiveLinhaIdProvider(detail.id)) ??
      (profiles.length == 1 ? profiles.first.verticalId : null);
  if (!context.mounted) return;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) => SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(sheetContext).bottom + 24,
        ),
        child: PurchaseRecurrenceForm(
          initialValue: detail.purchaseRecurrence,
          verticalId: verticalId,
          onSave: (command) async {
            final repository = ref.read(
              facilityPurchaseRecurrenceRepositoryProvider,
            );
            await savePurchaseRecurrence(
              command: command,
              update: (command) =>
                  repository.updatePurchaseRecurrence(detail.id, command),
              close: () {
                if (sheetContext.mounted) Navigator.of(sheetContext).pop();
              },
              refreshDetail: () {
                ref.read(facilityZipRepositoryProvider(detail.id)).refresh();
              },
              refreshExplore: ref
                  .read(exploreProvider.notifier)
                  .refreshAfterClinicUpdate,
              showSynchronizationWarning: (message) {
                if (context.mounted) {
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text(message)));
                }
              },
            );
          },
        ),
      ),
    ),
  );
}

// ===============================================================
// Scrollable content body — section order per Spec 0005 redesign
// ===============================================================
class _ClinicDetailContent extends ConsumerWidget {
  const _ClinicDetailContent({
    required this.data,
    required this.clinicId,
    required this.repository,
  });

  final FacilityDetailData? data;
  final String clinicId;
  final FacilityZipRepository repository;

  Future<void> _refresh() => repository.refresh();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail =
        data?.facility ??
        ref.watch(clinicDetailDisplayFacilityProvider(clinicId));
    final administrators = data?.administrators;
    final doctors = data?.doctors;
    final payers = data?.payerShares;
    final canMutate = ref.watch(canMutateFacilityProvider);
    final canSuggest = ref.watch(canCreateFieldSuggestionProvider);
    final canCreateVisit = ref.watch(canCreateVisitProvider);
    final canAssignConsultant = ref.watch(canAssignFacilityConsultantProvider);
    final userLinhaOptions =
        ref.watch(currentUserFacilityVerticalOptionsProvider).valueOrNull ??
        const [];
    final linhaOptions = detail == null
        ? const <BusinessVertical>[]
        : clinicDetailLinhaOptions(
            userOptions: userLinhaOptions,
            clinicProfiles: detail.verticalProfiles,
          );
    final clinicProfileIds =
        detail?.verticalProfiles
            .map((profile) => profile.verticalId)
            .where((id) => id.isNotEmpty)
            .toSet() ??
        const <String>{};
    final activeLinhaId = ref.watch(
      clinicDetailActiveLinhaIdProvider(clinicId),
    );
    final showLinhaSwitcher = shouldShowClinicDetailLinhaSwitcher(linhaOptions);
    final payersApplyToLinha =
        detail == null ||
        isClinicLinhaOrtopedia(
          profiles: detail.verticalProfiles,
          activeVerticalId: activeLinhaId,
        );

    void onLinhaChanged(String id) {
      ref.read(clinicDetailSelectedLinhaIdProvider(clinicId).notifier).state =
          id;
    }

    return RefreshIndicator(
      color: AppColors.navyBright,
      backgroundColor: Colors.white,
      onRefresh: _refresh,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Column(
            children: [
              Expanded(child: Container(color: AppColors.navyBright)),
              Expanded(child: Container(color: AppColors.surfaceTertiary)),
            ],
          ),
          CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: ColoredBox(
                  color: AppColors.surfaceTertiary,
                  child: Column(
                    children: [
                      ClinicHeaderSection(detail: detail, photos: data?.photos),
                      ClinicDetailQuickActions(
                        detail: detail,
                        canCreateVisit: canCreateVisit,
                      ),
                      ClinicDetailShortcuts(
                        facilityId: clinicId,
                        detail: detail,
                      ),
                      ClinicAdministrativeSection(
                        repository: repository,
                        clinicId: clinicId,
                        facilityName: detail?.name,
                        roster: administrators,
                        isLoadingMore: data?.administratorsLoadingMore ?? false,
                        canMutate: canMutate,
                      ),
                      ClinicDoctorsSection(
                        repository: repository,
                        clinicId: clinicId,
                        facilityName: detail?.name,
                        roster: doctors,
                        isLoadingMore: data?.doctorsLoadingMore ?? false,
                        canMutate: canMutate,
                      ),
                      ClinicFieldNotesSection(
                        facilityId: clinicId,
                        notes: data?.notes,
                        canAdd: canMutate,
                        onCreate: repository.createNote,
                      ),
                    ],
                  ),
                ),
              ),
              if (showLinhaSwitcher && activeLinhaId != null)
                SliverPersistentHeader(
                  pinned: true,
                  delegate: ClinicDetailLinhaHeaderDelegate(
                    options: linhaOptions,
                    selectedVerticalId: activeLinhaId,
                    onChanged: onLinhaChanged,
                  ),
                ),
              SliverToBoxAdapter(
                child: ColoredBox(
                  color: AppColors.surfaceTertiary,
                  child: Column(
                    children: [
                      ClinicPotentialSection(
                        verticalId: activeLinhaId,
                        page: data?.potentials,
                        canEdit: canMutate,
                        onSave: repository.replacePotentialValues,
                      ),
                      if (payersApplyToLinha)
                        ClinicPayersSection(
                          repository: repository,
                          clinicId: clinicId,
                          facilityName: detail?.name,
                          payers: payers,
                          canMutate: canMutate,
                        ),
                      ClinicMapSection(
                        clinicId: clinicId,
                        facilityName: detail?.name,
                        detail: detail,
                        nearby: data?.nearby,
                        clinicVerticalIds: clinicProfileIds,
                      ),
                      ClinicTeamSection(
                        clinicId: clinicId,
                        detail: detail,
                        activeVerticalId: activeLinhaId,
                        canManageConsultant: canAssignConsultant,
                      ),
                      ClinicPurchaseSection(
                        detail: detail,
                        canMutate: canMutate,
                      ),
                      if (canSuggest) const _SuggestEditBanner(),
                      if (canSuggest && detail != null)
                        _ClinicDeactivateButton(
                          clinicId: clinicId,
                          clinicName: detail.name,
                          commercialStatus: parseFacilityCommercialStatus(
                            detail.commercial?.commercialStatus,
                          ),
                        ),
                      SizedBox(height: MediaQuery.of(context).padding.bottom),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ClinicDetailQuickActions extends ConsumerWidget {
  const ClinicDetailQuickActions({
    super.key,
    required this.detail,
    required this.canCreateVisit,
  });

  final Facility? detail;
  final bool canCreateVisit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = this.detail;
    if (detail == null) return const _SectionLoadingCard(height: 72);

    Widget icon(IconData value) => CircleAvatar(
      backgroundColor: AppColors.navyBright.createSecondary(),
      radius: 18,
      child: Icon(value, size: 18, color: AppColors.navyBright),
    );

    return DetailQuickActions(
      themeColor: AppColors.navyBright,
      actions: [
        QuickActionItem(
          icon: icon(Icons.phone_rounded),
          label: const Text('Ligar'),
          onTap: () => launchContactUrl(
            context,
            url: callUrl(detail.contact?.phone),
            contactLabel: 'telefone',
          ),
        ),
        QuickActionItem(
          icon: icon(Icons.chat_rounded),
          label: const Text('WhatsApp'),
          onTap: () => launchContactUrl(
            context,
            url: whatsappUrl(detail.contact?.whatsapp ?? detail.contact?.phone),
            contactLabel: 'WhatsApp',
          ),
        ),
        QuickActionItem(
          icon: icon(Icons.directions_rounded),
          label: const Text('Rota'),
          onTap: () => launchMapsRoute(
            context,
            latitude: detail.address?.lat,
            longitude: detail.address?.lng,
            address: detail.address?.formattedAddress,
          ),
        ),
        if (canCreateVisit)
          QuickActionItem(
            icon: icon(Icons.calendar_month_rounded),
            label: const Text('Visita'),
            onTap: () => _createVisit(context, ref, detail.id),
          ),
      ],
    );
  }

  Future<void> _createVisit(
    BuildContext context,
    WidgetRef ref,
    String clinicId,
  ) async {
    try {
      await ref.read(clinicVisitsRepositoryProvider(clinicId)).createVisit();
      ref.invalidate(clinicVisitsRepositoryProvider(clinicId));
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Visita registrada com sucesso'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Erro ao registrar visita'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

class ClinicDetailShortcuts extends StatelessWidget {
  const ClinicDetailShortcuts({
    super.key,
    required this.facilityId,
    required this.detail,
  });

  final String facilityId;
  final Facility? detail;

  @override
  Widget build(BuildContext context) {
    final detail = this.detail;
    if (detail == null) return const _SectionLoadingCard();
    return ClinicTopShortcutsSection(
      facilityId: facilityId,
      facilityName: detail.name,
      detail: detail,
    );
  }
}

class ClinicPurchaseSection extends ConsumerWidget {
  const ClinicPurchaseSection({
    super.key,
    required this.detail,
    required this.canMutate,
  });

  final Facility? detail;
  final bool canMutate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = this.detail;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Compras',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0f1729),
                  letterSpacing: -0.3,
                ),
              ),
              if (canMutate && detail != null)
                _HeaderLinkButton(
                  label: 'Editar',
                  onTap: () =>
                      _openPurchaseRecurrenceEditor(context, ref, detail),
                ),
            ],
          ),
        ),
        if (detail == null)
          const _SectionLoadingCard()
        else
          PurchaseRecurrenceSection(value: detail.purchaseRecurrence),
      ],
    );
  }
}

class ClinicAdministrativeSection extends StatelessWidget {
  const ClinicAdministrativeSection({
    super.key,
    required this.repository,
    required this.clinicId,
    required this.facilityName,
    required this.roster,
    required this.isLoadingMore,
    required this.canMutate,
  });

  final FacilityZipRepository repository;
  final String clinicId;
  final String? facilityName;
  final FacilityRosterPage<AdministrativeProfessional>? roster;
  final bool isLoadingMore;
  final bool canMutate;

  @override
  Widget build(BuildContext context) {
    final items = roster?.items ?? const [];
    final hasMore =
        roster != null &&
        roster!.pagination.page < roster!.pagination.totalPages;

    void openList() {
      _openAdministratorsList(
        context,
        repository,
        clinicId: clinicId,
        facilityName: facilityName ?? '',
        rosterFallback: items,
      );
    }

    return Column(
      children: [
        ClinicSectionHeader(
          title: 'Administrativo',
          badge: _countBadge(roster?.pagination.total),
          trailing: items.isEmpty
              ? null
              : _HeaderLinkButton(label: 'Ver todos', onTap: openList),
        ),
        if (roster == null || facilityName == null)
          const _SectionLoadingCard()
        else
          ClinicAdminProfessionalsSection(
            professionals: items,
            facilityName: facilityName!,
            facilityId: clinicId,
            hasMore: hasMore,
            isLoadingMore: isLoadingMore,
            onLoadMore: repository.loadMoreAdministrators,
            onAssociate: canMutate ? openList : null,
          ),
      ],
    );
  }
}

class ClinicDoctorsSection extends StatelessWidget {
  const ClinicDoctorsSection({
    super.key,
    required this.repository,
    required this.clinicId,
    required this.facilityName,
    required this.roster,
    required this.isLoadingMore,
    required this.canMutate,
  });

  final FacilityZipRepository repository;
  final String clinicId;
  final String? facilityName;
  final FacilityRosterPage<ProfessionalRoster>? roster;
  final bool isLoadingMore;
  final bool canMutate;

  @override
  Widget build(BuildContext context) {
    final items = roster?.items ?? const [];
    final hasMore =
        roster != null &&
        roster!.pagination.page < roster!.pagination.totalPages;

    void openList() {
      _openDoctorsList(
        context,
        repository,
        clinicId: clinicId,
        facilityName: facilityName ?? '',
        rosterFallback: items,
      );
    }

    return Column(
      children: [
        ClinicSectionHeader(
          title: 'Médicos',
          badge: _countBadge(roster?.pagination.total),
          trailing: items.isEmpty
              ? null
              : _HeaderLinkButton(label: 'Ver todos', onTap: openList),
        ),
        if (roster == null || facilityName == null)
          const _SectionLoadingCard()
        else
          ClinicCrmDoctorsSection(
            doctors: items,
            facilityId: clinicId,
            hasMore: hasMore,
            isLoadingMore: isLoadingMore,
            onLoadMore: repository.loadMoreDoctors,
            onAssociate: canMutate ? openList : null,
            onDoctorUpdated: canMutate
                ? (_) => repository.refreshDoctors()
                : null,
          ),
      ],
    );
  }
}

class ClinicPayersSection extends StatelessWidget {
  const ClinicPayersSection({
    super.key,
    required this.repository,
    required this.clinicId,
    required this.facilityName,
    required this.payers,
    required this.canMutate,
  });

  final FacilityZipRepository repository;
  final String clinicId;
  final String? facilityName;
  final List<PayerShare>? payers;
  final bool canMutate;

  @override
  Widget build(BuildContext context) {
    void edit() {
      final loadedPayers = payers;
      if (loadedPayers == null || facilityName == null) return;
      _openPayerSourcesEditor(
        context,
        repository: repository,
        clinicId: clinicId,
        payers: loadedPayers,
      );
    }

    return Column(
      children: [
        ClinicSectionHeader(
          title: 'Fontes Pagadoras',
          trailing: !canMutate || payers == null || payers!.isEmpty
              ? null
              : _HeaderLinkButton(label: 'Editar', onTap: edit),
        ),
        if (payers == null || facilityName == null)
          const _SectionLoadingCard()
        else
          ClinicPayersBarSection(
            payers: payers!,
            summary: buildPayerMixSummary(payers!),
            facilityName: facilityName,
          ),
      ],
    );
  }
}

class ClinicMapSection extends StatelessWidget {
  const ClinicMapSection({
    super.key,
    required this.clinicId,
    required this.facilityName,
    required this.detail,
    required this.nearby,
    required this.clinicVerticalIds,
  });

  final String clinicId;
  final String? facilityName;
  final Facility? detail;
  final List<NearbyEstablishment>? nearby;
  final Set<String> clinicVerticalIds;

  @override
  Widget build(BuildContext context) {
    final detail = this.detail;
    final location = detail == null
        ? null
        : establishmentLocationFromFacility(detail);
    return Column(
      children: [
        const ClinicSectionHeader(title: 'Mapa e clínicas próximas'),
        if (detail == null)
          const _SectionLoadingCard(height: 180)
        else if (location == null)
          const ClinicDetailCard(
            child: Text(
              'Localização não disponível para este estabelecimento',
              style: TextStyle(fontSize: 13, color: AppColors.gray400),
            ),
          )
        else if (nearby == null || facilityName == null)
          const _SectionLoadingCard(height: 180)
        else
          ClinicLocationSection(
            facilityId: clinicId,
            facilityName: facilityName!,
            location: location,
            nearbyEstablishments: nearby!,
            clinicVerticalIds: clinicVerticalIds,
          ),
      ],
    );
  }
}

class ClinicTeamSection extends ConsumerWidget {
  const ClinicTeamSection({
    super.key,
    required this.clinicId,
    required this.detail,
    required this.activeVerticalId,
    required this.canManageConsultant,
  });

  final String clinicId;
  final Facility? detail;
  final String? activeVerticalId;
  final bool canManageConsultant;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = this.detail;
    return Column(
      children: [
        const ClinicSectionHeader(title: 'Equipe responsável'),
        if (detail == null)
          const _SectionLoadingCard()
        else
          ClinicContextSection(
            consultantName: detail.territory?.consultantName,
            consultantSince: detail.territory?.consultantSince,
            managerName: detail.territory?.managerName,
            managerSince: null,
            regionZoneLabel: detail.territory?.territoryName,
            city: (detail.address?.city.isNotEmpty ?? false)
                ? detail.address!.city
                : null,
            canManageConsultant: canManageConsultant,
            onAssignConsultant: canManageConsultant
                ? () => _assignClinicConsultant(
                    context,
                    ref,
                    facilityId: clinicId,
                    verticalId: activeVerticalId,
                  )
                : null,
            onUnassignConsultant:
                canManageConsultant &&
                    (detail.territory?.consultantName?.trim().isNotEmpty ==
                        true)
                ? () => _unassignClinicConsultant(
                    context,
                    ref,
                    facilityId: clinicId,
                  )
                : null,
          ),
      ],
    );
  }
}

Widget? _countBadge(int? count) {
  return count == null || count == 0 ? null : _CountBadge(count: count);
}

class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.blueLight,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        '$count',
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: AppColors.navyBright,
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
  const _HeaderLinkButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: AppColors.navyBright,
          ),
        ),
      ),
    );
  }
}

class _SectionLoadingCard extends StatelessWidget {
  const _SectionLoadingCard({this.height = 80});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: AtlasShimmer(
        child: Container(
          height: height,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
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
        color: AppColors.surfaceTertiary,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.edit_note_rounded,
            size: 18,
            color: AppColors.gray400,
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Toque nos ícones em qualquer campo. Sugestões passam por '
              'revisão administrativa antes de entrar no perfil.',
              style: TextStyle(fontSize: 11.5, color: AppColors.gray500),
            ),
          ),
        ],
      ),
    );
  }
}

/// Destructive action at the end of the clinic profile — button, not a card.
class _ClinicDeactivateButton extends ConsumerWidget {
  const _ClinicDeactivateButton({
    required this.clinicId,
    required this.clinicName,
    this.commercialStatus,
  });

  final String clinicId;
  final String clinicName;
  final FacilityCommercialStatus? commercialStatus;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 8),
      child: SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: () => requestClinicDeactivation(
            context,
            ref: ref,
            clinicId: clinicId,
            clinicName: clinicName,
            currentStatus:
                commercialStatus ?? FacilityCommercialStatus.registered,
          ),
          icon: const Icon(Icons.power_settings_new_rounded, size: 18),
          label: const Text('Solicitar desativação'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.error,
            side: const BorderSide(color: AppColors.red100),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

Future<void> _assignClinicConsultant(
  BuildContext context,
  WidgetRef ref, {
  required String facilityId,
  String? verticalId,
}) async {
  final userId = await UserPickerSheet.pickAssignee(
    context,
    role: UserRole.rep,
    verticalId: verticalId,
  );
  if (userId == null || userId == clearAssignee) return;
  if (!context.mounted) return;

  try {
    await ref
        .read(facilityConsultantAssignmentsRepositoryProvider(facilityId))
        .assign(userId: userId, verticalId: verticalId);
    await ref.read(facilityZipRepositoryProvider(facilityId)).refresh();
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Consultor atribuído.')));
  } on FacilityConsultantAssignmentsException catch (error) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          error.message ?? 'Não foi possível atribuir o consultor.',
        ),
      ),
    );
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Não foi possível atribuir o consultor.')),
    );
  }
}

Future<void> _unassignClinicConsultant(
  BuildContext context,
  WidgetRef ref, {
  required String facilityId,
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Remover consultor?'),
      content: const Text(
        'A clínica ficará sem consultor responsável até uma nova atribuição.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Remover'),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;

  try {
    await ref
        .read(facilityConsultantAssignmentsRepositoryProvider(facilityId))
        .unassignCurrent();
    await ref.read(facilityZipRepositoryProvider(facilityId)).refresh();
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Consultor removido.')));
  } on FacilityConsultantAssignmentsException catch (error) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(error.message ?? 'Não foi possível remover o consultor.'),
      ),
    );
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Não foi possível remover o consultor.')),
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
