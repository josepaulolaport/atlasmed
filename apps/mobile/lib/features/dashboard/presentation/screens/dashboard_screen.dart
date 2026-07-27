import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_summary.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_territory_card.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/purchase_status_donut_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/vertical_selector.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Desempenho / Dashboard — purchase-status donut + territory card.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initVertical());
  }

  /// Seeds [dashboardSelectedVerticalIdProvider] with the first accessible
  /// vertical. Once set, [build] picks it up, [dashboardRepositoryProvider]
  /// creates a new repo via family, and [build] also calls [ref.listen] to
  /// auto-trigger the first fetch.
  Future<void> _initVertical() async {
    final options =
        await ref.read(dashboardVerticalOptionsProvider.future);
    if (options.isEmpty) return;
    ref.read(dashboardSelectedVerticalIdProvider.notifier).state =
        options.first.id;
  }

  void _triggerFetch(String verticalId) {
    ref.read(dashboardRepositoryProvider(verticalId)).fetchSummary();
  }

  Future<void> _onRefresh() async {
    final verticalId = ref.read(dashboardSelectedVerticalIdProvider);
    if (verticalId == null) return;
    await ref.read(dashboardRepositoryProvider(verticalId)).refresh();
  }

  void _onVerticalChanged(String? id) {
    if (id == null) return;
    ref.read(dashboardSelectedVerticalIdProvider.notifier).state = id;
    _triggerFetch(id);
  }

  @override
  Widget build(BuildContext context) {
    final optionsAsync = ref.watch(dashboardVerticalOptionsProvider);
    final selectedVerticalId = ref.watch(dashboardSelectedVerticalIdProvider);

    // Once a vertical is selected, get its dedicated repository.
    // Build falls through to the "waiting" state when still null.
    final String? effectiveVerticalId = selectedVerticalId ??
        optionsAsync.maybeWhen(
          data: (o) => o.isNotEmpty ? o.first.id : null,
          orElse: () => null,
        );

    // Trigger a fetch whenever the repository instance changes
    // (first creation or vertical switch).
    ref.listen<String?>(
      dashboardSelectedVerticalIdProvider,
      (prev, next) {
        if (next != null && next != prev) _triggerFetch(next);
      },
    );

    final repository = effectiveVerticalId != null
        ? ref.watch(dashboardRepositoryProvider(effectiveVerticalId))
        : null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Desempenho'),
      body: RefreshIndicator(
        onRefresh: _onRefresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            optionsAsync.maybeWhen(
              data: (options) {
                if (options.length < 2) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: VerticalSelector(
                    verticals: options,
                    selectedVerticalId:
                        selectedVerticalId ?? options.first.id,
                    allowAll: false,
                    onChanged: _onVerticalChanged,
                  ),
                );
              },
              orElse: () => const SizedBox.shrink(),
            ),
            if (repository != null)
              RepositoryBuilder<DashboardRepository, DashboardSummary>(
                repository: repository,
                builder: (context, summary, repo) {
                  if (summary == null) {
                    return const Padding(
                      padding: EdgeInsets.only(top: 80),
                      child: Center(child: CircularProgressIndicator()),
                    );
                  }
                  return Column(
                    children: [
                      PurchaseStatusDonutCard(
                        data: summary.purchaseStatus,
                        onBucketTap: (bucket) {
                          final verticalId = ref.read(
                            dashboardSelectedVerticalIdProvider,
                          );
                          if (verticalId != null) {
                            ref
                                .read(
                                    selectedFacilityVerticalIdProvider.notifier)
                                .state = verticalId;
                          }
                          ref
                              .read(exploreProvider.notifier)
                              .applyPurchaseBucket(bucket);
                          context.go('/explore');
                        },
                      ),
                      const SizedBox(height: 12),
                      DashboardTerritoryCard(data: summary.territory),
                    ],
                  );
                },
              )
            else
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(child: CircularProgressIndicator()),
              ),
          ],
        ),
      ),
    );
  }
}
