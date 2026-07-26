import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_territory_card.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/purchase_status_donut_card.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/vertical_selector.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Desempenho / Dashboard — purchase-status donut + territory card.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final optionsAsync = ref.watch(dashboardVerticalOptionsProvider);
    final selectedVerticalId = ref.watch(dashboardSelectedVerticalIdProvider);
    final summaryAsync = ref.watch(dashboardSummaryProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            const AtlasTopBar(page: 'Desempenho'),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(dashboardSummaryProvider);
                  await ref.read(dashboardSummaryProvider.future);
                },
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  children: [
                    optionsAsync.maybeWhen(
                      data: (options) {
                        if (options.length < 2) {
                          return const SizedBox.shrink();
                        }
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: VerticalSelector(
                            verticals: options,
                            selectedVerticalId:
                                selectedVerticalId ?? options.first.id,
                            allowAll: false,
                            onChanged: (id) {
                              if (id == null) return;
                              ref
                                      .read(
                                        dashboardSelectedVerticalIdProvider
                                            .notifier,
                                      )
                                      .state =
                                  id;
                            },
                          ),
                        );
                      },
                      orElse: () => const SizedBox.shrink(),
                    ),
                    summaryAsync.when(
                      loading: () => const Padding(
                        padding: EdgeInsets.only(top: 80),
                        child: Center(child: CircularProgressIndicator()),
                      ),
                      error: (err, _) => Padding(
                        padding: const EdgeInsets.only(top: 48),
                        child: Column(
                          children: [
                            const Text(
                              'Não foi possível carregar o desempenho',
                              style: TextStyle(
                                fontSize: 14,
                                color: Color(0xFF6b7280),
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextButton(
                              onPressed: () =>
                                  ref.invalidate(dashboardSummaryProvider),
                              child: const Text('Tentar de novo'),
                            ),
                          ],
                        ),
                      ),
                      data: (summary) {
                        if (summary == null) {
                          return const Padding(
                            padding: EdgeInsets.only(top: 48),
                            child: Center(
                              child: Text(
                                'Nenhuma vertical atribuída',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Color(0xFF6b7280),
                                ),
                              ),
                            ),
                          );
                        }
                        return Column(
                          children: [
                            PurchaseStatusDonutCard(
                              data: summary.purchaseStatus,
                            ),
                            const SizedBox(height: 12),
                            DashboardTerritoryCard(data: summary.territory),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
