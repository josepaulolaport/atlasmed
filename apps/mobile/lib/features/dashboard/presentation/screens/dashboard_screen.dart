import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_summary.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/dashboard_repository.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_territory_card.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/purchase_status_donut_card.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/vertical_selector.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Desempenho / Dashboard — purchase-status donut + territory card.
///
/// Default: no Linha filter — API returns token-scoped union. Selector only
/// when user has 2+ linhas; picking one narrows the request.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  String? _fetchError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _triggerFetch());
  }

  Future<void> _triggerFetch() async {
    final verticalId = ref.read(dashboardSelectedVerticalIdProvider);
    setState(() => _fetchError = null);
    try {
      await ref.read(dashboardRepositoryProvider(verticalId)).fetchSummary();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _fetchError = 'Não foi possível carregar o desempenho.';
      });
    }
  }

  Future<void> _onRefresh() async {
    ref.invalidate(dashboardVerticalOptionsProvider);
    await _triggerFetch();
  }

  void _onVerticalChanged(String? id) {
    // [ref.listen] below kicks the fetch when selection changes.
    ref.read(dashboardSelectedVerticalIdProvider.notifier).state = id;
  }

  @override
  Widget build(BuildContext context) {
    final optionsAsync = ref.watch(dashboardVerticalOptionsProvider);
    final selectedVerticalId = ref.watch(dashboardSelectedVerticalIdProvider);
    final repository = ref.watch(
      dashboardRepositoryProvider(selectedVerticalId),
    );

    ref.listen<String?>(dashboardSelectedVerticalIdProvider, (prev, next) {
      if (next != prev) _triggerFetch();
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Desempenho'),
      body: RefreshIndicator(
        onRefresh: _onRefresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            optionsAsync.maybeWhen(
              data: (options) {
                if (options.length < 2) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: VerticalSelector(
                    verticals: options,
                    selectedVerticalId: selectedVerticalId,
                    allowAll: true,
                    onChanged: _onVerticalChanged,
                  ),
                );
              },
              orElse: () => const SizedBox.shrink(),
            ),
            if (_fetchError != null)
              _DashboardMessage(
                title: 'Falha ao carregar',
                message: _fetchError!,
                actionLabel: 'Tentar novamente',
                onAction: _triggerFetch,
              )
            else
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
                          final uri = Uri(
                            path: '/dashboard/facilities/$bucket',
                            queryParameters: {'verticalId': ?verticalId},
                          );
                          context.push(uri.toString());
                        },
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
    );
  }
}

class _DashboardMessage extends StatelessWidget {
  const _DashboardMessage({
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 64),
      child: Column(
        children: [
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: AppColors.gray500),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 16),
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}
