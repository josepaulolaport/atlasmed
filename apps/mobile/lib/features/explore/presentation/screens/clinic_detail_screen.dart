import 'package:flutter/cupertino.dart'
    show CupertinoSliverRefreshControl, CupertinoTheme;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/navigation/app_route_observer.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_vertical_rep_assignments_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_vertical_rep_assignments_provider.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/user_picker_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_zip_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/purchase_recurrence_save.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/establishment_detail_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_visits_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_nearby_provider.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/providers/purchase_recurrence_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_notes_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/quick_actions.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_orders_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_payers_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_roster_provider.dart';
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
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_orders_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_payers_bar_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_potential_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_section_header.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_top_shortcuts_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/doctors_list_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_payer_sources_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/purchase_recurrence_form.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/purchase_recurrence_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

// ===============================================================
// ClinicDetailScreen — establishment detail, per Spec 0005 redesign
// ===============================================================
class ClinicDetailScreen extends ConsumerStatefulWidget {
  final int clinicId;

  /// Linha from navigation (Desempenho / Explorar filter), if any.
  final int? initialVerticalId;

  const ClinicDetailScreen({
    super.key,
    required this.clinicId,
    this.initialVerticalId,
  });

  @override
  ConsumerState<ClinicDetailScreen> createState() => _ClinicDetailScreenState();
}

class _ClinicDetailScreenState extends ConsumerState<ClinicDetailScreen>
    with WidgetsBindingObserver, RouteAware {
  /// Avoid refetch storms when resume + didPopNext fire close together.
  static const _minRefreshGap = Duration(seconds: 15);
  DateTime? _lastVisibilityRefreshAt;
  var _seededEntryVertical = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  void _seedEntryVerticalIfNeeded() {
    if (_seededEntryVertical) return;
    final entryId = widget.initialVerticalId;
    if (entryId == null) {
      _seededEntryVertical = true;
      return;
    }
    _seededEntryVertical = true;
    // Must not write providers during build/initState — schedule after frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref
              .read(
                clinicDetailEntryVerticalIdProvider(widget.clinicId).notifier,
              )
              .state =
          entryId;
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is PageRoute) {
      appRouteObserver.subscribe(this, route);
    }
  }

  @override
  void dispose() {
    appRouteObserver.unsubscribe(this);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshClinicIfStale();
    }
  }

  @override
  void didPopNext() {
    // A route above this screen was popped — clinic is visible again.
    _refreshClinicIfStale();
  }

  void _refreshClinicIfStale() {
    final now = DateTime.now();
    final last = _lastVisibilityRefreshAt;
    if (last != null && now.difference(last) < _minRefreshGap) return;
    _lastVisibilityRefreshAt = now;

    final clinicId = widget.clinicId;
    // Refresh vertical-scoped detail + photos only — keep section notifiers.
    // ignore: unused_result
    ref.read(clinicDetailRepositoryProvider(clinicId)).refresh();
    // ignore: unused_result
    ref.read(facilityPhotosRepositoryProvider(clinicId)).refresh();
  }

  @override
  Widget build(BuildContext context) {
    _seedEntryVerticalIfNeeded();
    final clinicId = widget.clinicId;
    final repo = ref.watch(facilityZipRepositoryProvider(clinicId));
    final displayFallback = ref.watch(
      clinicDetailDisplayFacilityProvider(clinicId),
    );

    return Scaffold(
      backgroundColor: AppColors.surfaceTertiary,
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
      body: RepositoryBuilder<FacilityZipRepository, FacilityWithIntegrations>(
        repository: repo,
        builder: (context, data, repository) {
          final zipFacility = data?.facility;
          if (zipFacility != null &&
              zipFacility.id > 0 &&
              _shouldUpdateLoadedFacility(
                ref.read(clinicDetailLoadedFacilityProvider(clinicId)),
                zipFacility,
              )) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!context.mounted) return;
              ref
                      .read(
                        clinicDetailLoadedFacilityProvider(clinicId).notifier,
                      )
                      .state =
                  zipFacility;
            });
          }
          // Prefer live zip; fall back to loaded/shell so Linha refetch and
          // list→detail navigation do not flash a full-page skeleton.
          final detail = (zipFacility != null && zipFacility.id > 0)
              ? zipFacility
              : displayFallback;
          if (detail == null || detail.id <= 0) {
            return _loadingSkeleton(context);
          }
          return _ClinicDetailBody(
            detail: detail,
            clinicId: clinicId,
            repository: repository,
          );
        },
      ),
    );
  }

  Widget _loadingSkeleton(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          _buildHeaderSkeleton(context),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: List.generate(
                6,
                (_) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: _SkeletonBlock(height: 100),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderSkeleton(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Container(
      height: 180 + top,
      decoration: const BoxDecoration(
        color: AppColors.navyBright,
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
  if (raw.contains('403') || raw.contains('forbidden')) {
    return 'Você não tem permissão para acessar este estabelecimento.';
  }
  if (raw.contains('401') || raw.contains('unauthorized')) {
    return 'Sua sessão expirou. Faça login novamente.';
  }
  return 'Algo deu errado ao buscar os dados. Tente novamente em instantes.';
}

Future<void> _openAdministratorsList(
  BuildContext context,
  WidgetRef ref, {
  required int clinicId,
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
  // Prefer retry over invalidate — keeps strip items visible while refetching.
  await ref
      .read(facilityAdministratorsRosterProvider(clinicId).notifier)
      .retry();
}

Future<void> _openDoctorsList(
  BuildContext context,
  WidgetRef ref, {
  required int clinicId,
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
  await ref.read(facilityDoctorsRosterProvider(clinicId).notifier).retry();
}

Future<void> _openPayerSourcesEditor(
  BuildContext context,
  WidgetRef ref, {
  required int clinicId,
  required List<PayerShare> payers,
}) async {
  List<PayerCatalogEntry> catalog;
  try {
    catalog = await ref.read(healthcareProvidersCatalogProvider.future);
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
    await ref.read(facilityPayersProvider(clinicId).notifier).replace(updated);
    ref.invalidate(healthcareProvidersCatalogProvider);
    // Pull again from API so chart/legend match persisted shares (type, pacote…).
    await ref.read(facilityPayersProvider(clinicId).notifier).retry();
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
                ref.invalidate(clinicDetailRepositoryProvider(detail.id));
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
// Body — fixed blue header (outside the scroll) + scrollable sections
// ===============================================================
class _ClinicDetailBody extends ConsumerWidget {
  const _ClinicDetailBody({
    required this.detail,
    required this.clinicId,
    required this.repository,
  });

  final Facility detail;
  final int clinicId;
  final FacilityZipRepository repository;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sections = ref
        .watch(establishmentDetailSectionsProvider(clinicId))
        .valueOrNull;

    return _ClinicDetailContent(
      detail: detail,
      clinicId: clinicId,
      sections: sections,
      repository: repository,
      onRefresh: () async {
        ref.invalidate(establishmentDetailSectionsProvider(clinicId));
        ref.invalidate(clinicVisitsRepositoryProvider(clinicId));
        ref.invalidate(facilityNotesProvider(clinicId));
        ref.invalidate(facilityNearbyPreviewProvider(clinicId));
        final doctorsNotifier = ref.read(
          facilityDoctorsRosterProvider(clinicId).notifier,
        );
        final adminsNotifier = ref.read(
          facilityAdministratorsRosterProvider(clinicId).notifier,
        );
        await Future.wait([
          ref.read(clinicDetailRepositoryProvider(clinicId)).refresh(),
          ref.read(facilityPhotosRepositoryProvider(clinicId)).refresh(),
          ref.read(establishmentDetailSectionsProvider(clinicId).future),
          ref.read(facilityNearbyPreviewProvider(clinicId).future),
          ref.read(facilityNotesProvider(clinicId).future),
          doctorsNotifier.retry(),
          adminsNotifier.retry(),
          ref.read(facilityPayersProvider(clinicId).notifier).retry(),
          ref.read(facilityOrdersProvider(clinicId).notifier).retry(),
        ]);
      },
    );
  }
}

// ===============================================================
// Scrollable content body — section order per Spec 0005 redesign
// ===============================================================
class _ClinicDetailContent extends ConsumerWidget {
  final Facility detail;
  final int clinicId;
  final EstablishmentDetailSections? sections;
  final FacilityZipRepository repository;
  final Future<void> Function() onRefresh;
  const _ClinicDetailContent({
    required this.detail,
    required this.clinicId,
    required this.repository,
    required this.onRefresh,
    this.sections,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sectionsAsync = ref.watch(
      establishmentDetailSectionsProvider(clinicId),
    );
    final adminsRoster = ref.watch(
      facilityAdministratorsRosterProvider(clinicId),
    );
    final doctorsRoster = ref.watch(facilityDoctorsRosterProvider(clinicId));
    final payersState = ref.watch(facilityPayersProvider(clinicId));
    final ordersState = ref.watch(facilityOrdersProvider(clinicId));

    final userLinhaOptions =
        ref.watch(currentUserFacilityVerticalOptionsProvider).valueOrNull ??
        const [];
    final linhaOptions = clinicDetailLinhaOptions(
      userOptions: userLinhaOptions,
      clinicProfiles: detail.verticalProfiles,
    );
    final clinicProfileIds = detail.verticalProfiles
        .map((p) => p.verticalId)
        .where((id) => (id > 0))
        .toSet();
    final knownIds = ref.watch(clinicDetailKnownProfileIdsProvider(clinicId));
    if (clinicProfileIds.isNotEmpty &&
        !_sameIdSet(knownIds, clinicProfileIds)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        ref.read(clinicDetailKnownProfileIdsProvider(clinicId).notifier).state =
            clinicProfileIds;
      });
    }
    final activeLinhaId = ref.watch(
      clinicDetailActiveLinhaIdProvider(clinicId),
    );
    final showLinhaSwitcher = shouldShowClinicDetailLinhaSwitcher(linhaOptions);
    final payersApplyToLinha = isClinicLinhaOrtopedia(
      profiles: detail.verticalProfiles,
      activeVerticalId: activeLinhaId,
    );

    final effectivePayers = payersApplyToLinha
        ? payersState.payers
        : const <PayerShare>[];
    final effectivePayersSummary = buildPayerMixSummary(effectivePayers);
    final effectiveOrders = ordersState.orders;
    final location = establishmentLocationFromDetail(detail);
    final nearbyAsync = ref.watch(facilityNearbyPreviewProvider(clinicId));
    final canMutate = ref.watch(canMutateFacilityProvider);
    final canAssignConsultant = ref.watch(canAssignFacilityConsultantProvider);
    final canSuggest = ref.watch(canCreateFieldSuggestionProvider);

    void onLinhaChanged(int id) {
      ref.read(clinicDetailSelectedLinhaIdProvider(clinicId).notifier).state =
          id;
    }

    return CustomScrollView(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      slivers: [
        CupertinoSliverRefreshControl(
          onRefresh: onRefresh,
          builder:
              (
                context,
                refreshState,
                pulledExtent,
                refreshTriggerPullDistance,
                refreshIndicatorExtent,
              ) => ColoredBox(
                color: AppColors.navyBright,
                child: CupertinoTheme(
                  data: CupertinoTheme.of(
                    context,
                  ).copyWith(brightness: Brightness.dark),
                  child: CupertinoSliverRefreshControl.buildRefreshIndicator(
                    context,
                    refreshState,
                    pulledExtent,
                    refreshTriggerPullDistance,
                    refreshIndicatorExtent,
                  ),
                ),
              ),
        ),
        SliverToBoxAdapter(
          child: ColoredBox(
            color: AppColors.surfaceTertiary,
            child: Column(
              children: [
                RepositoryBuilder<
                  FacilityZipRepository,
                  FacilityWithIntegrations
                >(
                  repository: repository,
                  builder: (context, data, _) {
                    final zipPhotos = data?.photos;
                    final photos = zipPhotos != null && zipPhotos.isNotEmpty
                        ? zipPhotos.first
                        : sections?.photos;
                    return ClinicHeaderSection(
                      detail: detail,
                      sections: sections,
                      photos: photos,
                    );
                  },
                ),
                DetailQuickActions(
                  themeColor: AppColors.navyBright,
                  actions: [
                    QuickActionItem(
                      icon: CircleAvatar(
                        backgroundColor: AppColors.navyBright.createSecondary(),
                        radius: 18,
                        child: const Icon(
                          Icons.phone_rounded,
                          size: 18,
                          color: AppColors.navyBright,
                        ),
                      ),
                      label: const Text('Ligar'),
                      onTap: () => launchContactUrl(
                        context,
                        url: callUrl(detail.contact?.phone),
                        contactLabel: 'telefone',
                      ),
                    ),
                    QuickActionItem(
                      icon: CircleAvatar(
                        backgroundColor: AppColors.navyBright.createSecondary(),
                        radius: 18,
                        child: const Icon(
                          Icons.chat_rounded,
                          size: 18,
                          color: AppColors.navyBright,
                        ),
                      ),
                      label: const Text('WhatsApp'),
                      onTap: () => launchContactUrl(
                        context,
                        url: whatsappUrl(
                          detail.contact?.whatsapp ?? detail.contact?.phone,
                        ),
                        contactLabel: 'WhatsApp',
                      ),
                    ),
                    QuickActionItem(
                      icon: CircleAvatar(
                        backgroundColor: AppColors.navyBright.createSecondary(),
                        radius: 18,
                        child: const Icon(
                          Icons.directions_rounded,
                          size: 18,
                          color: AppColors.navyBright,
                        ),
                      ),
                      label: const Text('Rota'),
                      onTap: () => launchMapsRoute(
                        context,
                        latitude: detail.address?.lat,
                        longitude: detail.address?.lng,
                        address: detail.address?.formattedAddress,
                      ),
                    ),
                    if (ref.watch(canCreateVisitProvider))
                      QuickActionItem(
                        icon: CircleAvatar(
                          backgroundColor: AppColors.navyBright
                              .createSecondary(),
                          radius: 18,
                          child: const Icon(
                            Icons.calendar_month_rounded,
                            size: 18,
                            color: AppColors.navyBright,
                          ),
                        ),
                        label: const Text('Visita'),
                        onTap: () async {
                          try {
                            final repo = ref.read(
                              clinicVisitsRepositoryProvider(detail.id),
                            );
                            await repo.createVisit();
                            ref.invalidate(
                              clinicVisitsRepositoryProvider(detail.id),
                            );
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Visita registrada com sucesso',
                                  ),
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
                    QuickActionItem(
                      icon: CircleAvatar(
                        backgroundColor: AppColors.navyBright.createSecondary(),
                        radius: 18,
                        child: const Icon(
                          Icons.note_add_rounded,
                          size: 18,
                          color: AppColors.navyBright,
                        ),
                      ),
                      label: const Text('Pedido'),
                      onTap: () => const NewOrderRoute().push(context),
                    ),
                  ],
                ),
                ClinicTopShortcutsSection(
                  facilityId: clinicId,
                  facilityName: detail.name,
                  detail: detail,
                ),
                ClinicSectionHeader(
                  title: 'Administrativo',
                  badge: adminsRoster.total == 0
                      ? null
                      : _CountBadge(count: adminsRoster.total),
                  trailing: adminsRoster.items.isEmpty
                      ? null
                      : _HeaderLinkButton(
                          label: 'Ver todos',
                          onTap: () => _openAdministratorsList(
                            context,
                            ref,
                            clinicId: clinicId,
                            facilityName: detail.name,
                            rosterFallback: adminsRoster.items,
                          ),
                        ),
                ),
                if (adminsRoster.loading && adminsRoster.items.isEmpty)
                  const _SectionLoadingCard()
                else if (adminsRoster.error != null &&
                    adminsRoster.items.isEmpty)
                  _SectionErrorCard(
                    message: _friendlyLoadError(adminsRoster.error!),
                    onRetry: () => ref
                        .read(
                          facilityAdministratorsRosterProvider(
                            clinicId,
                          ).notifier,
                        )
                        .retry(),
                  )
                else
                  ClinicAdminProfessionalsSection(
                    professionals: adminsRoster.items,
                    facilityName: detail.name,
                    facilityId: clinicId,
                    hasMore: adminsRoster.hasMore,
                    isLoadingMore: adminsRoster.loadingMore,
                    onLoadMore: () => ref
                        .read(
                          facilityAdministratorsRosterProvider(
                            clinicId,
                          ).notifier,
                        )
                        .loadMore(),
                    onAssociate: canMutate
                        ? () => _openAdministratorsList(
                            context,
                            ref,
                            clinicId: clinicId,
                            facilityName: detail.name,
                            rosterFallback: adminsRoster.items,
                          )
                        : null,
                  ),
                ClinicSectionHeader(
                  title: 'Médicos',
                  badge: doctorsRoster.total == 0
                      ? null
                      : _CountBadge(count: doctorsRoster.total),
                  trailing: doctorsRoster.items.isEmpty
                      ? null
                      : _HeaderLinkButton(
                          label: 'Ver todos / Associar médico',
                          onTap: () => _openDoctorsList(
                            context,
                            ref,
                            clinicId: clinicId,
                            facilityName: detail.name,
                            rosterFallback: doctorsRoster.items,
                          ),
                        ),
                ),
                if (doctorsRoster.loading && doctorsRoster.items.isEmpty)
                  const _SectionLoadingCard()
                else if (doctorsRoster.error != null &&
                    doctorsRoster.items.isEmpty)
                  _SectionErrorCard(
                    message: _friendlyLoadError(doctorsRoster.error!),
                    onRetry: () => ref
                        .read(facilityDoctorsRosterProvider(clinicId).notifier)
                        .retry(),
                  )
                else
                  ClinicCrmDoctorsSection(
                    doctors: doctorsRoster.items,
                    facilityId: clinicId,
                    hasMore: doctorsRoster.hasMore,
                    isLoadingMore: doctorsRoster.loadingMore,
                    onLoadMore: () => ref
                        .read(facilityDoctorsRosterProvider(clinicId).notifier)
                        .loadMore(),
                    onAssociate: canMutate
                        ? () => _openDoctorsList(
                            context,
                            ref,
                            clinicId: clinicId,
                            facilityName: detail.name,
                            rosterFallback: doctorsRoster.items,
                          )
                        : null,
                    onDoctorUpdated: canMutate
                        ? (updated) {
                            ref
                                .read(
                                  facilityDoctorsRosterProvider(
                                    clinicId,
                                  ).notifier,
                                )
                                .replaceWhere(
                                  (d) => d.id == updated.id,
                                  (_) => updated,
                                );
                          }
                        : null,
                  ),
                const ClinicSectionHeader(title: 'Notas de campo'),
                ClinicFieldNotesSection(facilityId: clinicId),
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
                  facilityId: clinicId,
                  canEdit: canMutate,
                ),
                if (payersApplyToLinha) ...[
                  ClinicSectionHeader(
                    title: 'Fontes Pagadoras',
                    trailing: !canMutate
                        ? null
                        : _HeaderLinkButton(
                            label: 'Editar',
                            onTap: () => _openPayerSourcesEditor(
                              context,
                              ref,
                              clinicId: clinicId,
                              payers: effectivePayers,
                            ),
                          ),
                  ),
                  if (payersState.loading && effectivePayers.isEmpty)
                    const _SectionLoadingCard()
                  else if (payersState.error != null && effectivePayers.isEmpty)
                    _SectionErrorCard(
                      message: _friendlyLoadError(payersState.error!),
                      onRetry: () => ref
                          .read(facilityPayersProvider(clinicId).notifier)
                          .retry(),
                    )
                  else
                    ClinicPayersBarSection(
                      payers: effectivePayers,
                      summary: effectivePayersSummary,
                      facilityName: detail.name,
                    ),
                ],
                const ClinicSectionHeader(title: 'Mapa e clínicas próximas'),
                if (location == null)
                  const ClinicDetailCard(
                    child: Text(
                      'Localização não disponível para este estabelecimento',
                      style: TextStyle(fontSize: 13, color: AppColors.gray400),
                    ),
                  )
                else
                  nearbyAsync.when(
                    loading: () => const _SectionLoadingCard(),
                    error: (err, _) => _SectionErrorCard(
                      message: _friendlyLoadError(err),
                      onRetry: () => ref.invalidate(
                        facilityNearbyPreviewProvider(clinicId),
                      ),
                    ),
                    data: (nearby) => ClinicLocationSection(
                      facilityId: clinicId,
                      facilityName: detail.name,
                      location: location,
                      nearbyEstablishments: nearby,
                      clinicVerticalIds: detail.verticalProfiles
                          .map((p) => p.verticalId)
                          .toSet(),
                    ),
                  ),

                ClinicSectionHeader(
                  title: 'Histórico de pedidos',
                  badge: effectiveOrders.isEmpty
                      ? null
                      : _CountBadge(count: effectiveOrders.length),
                  trailing: effectiveOrders.isEmpty
                      ? null
                      : _HeaderLinkButton(
                          label: 'Ver todos',
                          // Shell branch route — must go(), not push().
                          onTap: () => const OrdersRoute().go(context),
                        ),
                ),
                if (ordersState.loading && effectiveOrders.isEmpty)
                  const _SectionLoadingCard()
                else if (ordersState.error != null && effectiveOrders.isEmpty)
                  _SectionErrorCard(
                    message: _friendlyLoadError(ordersState.error!),
                    onRetry: () => ref
                        .read(facilityOrdersProvider(clinicId).notifier)
                        .retry(),
                  )
                else
                  ClinicOrdersSection(
                    orders: effectiveOrders,
                    facilityId: clinicId,
                  ),
                const ClinicSectionHeader(title: 'Equipe responsável'),
                sectionsAsync.when(
                  loading: () => const _SectionLoadingCard(),
                  error: (err, _) => _SectionErrorCard(
                    message: _friendlyLoadError(err),
                    onRetry: () => ref.invalidate(
                      establishmentDetailSectionsProvider(clinicId),
                    ),
                  ),
                  data: (sections) => ClinicContextSection(
                    consultantName:
                        detail.territory?.consultantName ??
                        sections.consultantName,
                    consultantSince:
                        detail.territory?.consultantSince ??
                        sections.consultantSince,
                    // Manager is derived from the consultor's users.manager_id — no
                    // facility tenure. Prefer live; no mock fallback (would invent a manager).
                    managerName: detail.territory?.managerName,
                    managerSince: null,
                    regionZoneLabel:
                        detail.territory?.territoryName ??
                        sections.regionZoneLabel,
                    city: (detail.address?.city.isNotEmpty ?? false)
                        ? detail.address!.city
                        : null,
                    canManageConsultant: canAssignConsultant,
                    onAssignConsultant:
                        canAssignConsultant && activeLinhaId != null
                        ? () => _assignClinicConsultant(
                            context,
                            ref,
                            facilityId: clinicId,
                            verticalId: activeLinhaId,
                          )
                        : null,
                    onUnassignConsultant:
                        canAssignConsultant &&
                            activeLinhaId != null &&
                            (detail.territory?.consultantName
                                    ?.trim()
                                    .isNotEmpty ==
                                true)
                        ? () => _unassignClinicConsultant(
                            context,
                            ref,
                            facilityId: clinicId,
                            verticalId: activeLinhaId,
                          )
                        : null,
                  ),
                ),
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
                      if (canMutate)
                        _HeaderLinkButton(
                          label: 'Editar',
                          onTap: () => _openPurchaseRecurrenceEditor(
                            context,
                            ref,
                            detail,
                          ),
                        ),
                    ],
                  ),
                ),
                PurchaseRecurrenceSection(value: detail.purchaseRecurrence),
                if (canSuggest) const _SuggestEditBanner(),
                if (canSuggest)
                  _ClinicDeactivateButton(
                    clinicId: clinicId,
                    clinicName: detail.name,
                    commercialStatus: sectionsAsync
                        .valueOrNull
                        ?.statusSignals
                        ?.commercialStatus,
                  ),
                SizedBox(height: MediaQuery.of(context).padding.bottom),
              ],
            ),
          ),
        ),
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
        color: AppColors.red50,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message,
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.red,
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
                foregroundColor: AppColors.red,
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

  final int clinicId;
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

bool _sameIdSet(Set<int> a, Set<int> b) {
  if (identical(a, b)) return true;
  if (a.length != b.length) return false;
  return a.containsAll(b);
}

bool _shouldUpdateLoadedFacility(Facility? previous, Facility next) {
  if (previous == null) return true;
  return previous.updatedAt != next.updatedAt ||
      previous.name != next.name ||
      previous.territory?.consultantName != next.territory?.consultantName ||
      previous.territory?.managerName != next.territory?.managerName ||
      previous.purchaseRecurrence != next.purchaseRecurrence ||
      previous.commercial?.commercialStatus !=
          next.commercial?.commercialStatus ||
      previous.verticalProfiles.length != next.verticalProfiles.length;
}

Future<void> _assignClinicConsultant(
  BuildContext context,
  WidgetRef ref, {
  required int facilityId,
  required int verticalId,
}) async {
  final userId = await UserPickerSheet.pickAssignee(
    context,
    role: UserRole.rep,
    verticalId: verticalId,
  );
  if (userId == null || userId == kClearAssigneeId) return;
  if (!context.mounted) return;

  try {
    await ref
        .read(facilityVerticalRepAssignmentsRepositoryProvider(facilityId))
        .assign(userId: userId, verticalId: verticalId);
    ref.invalidate(clinicDetailRepositoryProvider(facilityId));
    ref.invalidate(establishmentDetailSectionsProvider(facilityId));
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Consultor atribuído.')));
  } on FacilityVerticalRepAssignmentsException catch (error) {
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
  required int facilityId,
  required int verticalId,
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
        .read(facilityVerticalRepAssignmentsRepositoryProvider(facilityId))
        .unassign(verticalId: verticalId);
    ref.invalidate(clinicDetailRepositoryProvider(facilityId));
    ref.invalidate(establishmentDetailSectionsProvider(facilityId));
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Consultor removido.')));
  } on FacilityVerticalRepAssignmentsException catch (error) {
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
class _SkeletonBlock extends StatelessWidget {
  final double height;
  const _SkeletonBlock({required this.height});

  @override
  Widget build(BuildContext context) {
    return AtlasShimmer(
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: AppColors.surfaceSecondary,
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}
