import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const _metricTitles = <String, String>{
  'assigned-clinics': 'Clínicas atribuídas',
  'coverage': 'Cobertura',
  'cadastro-completion': 'Cadastro completo',
  'unassigned-clinics': 'Clínicas não atribuídas',
  'bucket-active': 'Clientes ativos',
  'bucket-inactive': 'Clientes inativos',
  'bucket-never-bought': 'Nunca compraram',
};

/// The per-clinic breakdown behind a metric card (spec 0014 §4.1).
///
/// Same shape at every level, and every row links to the clinic profile — so a
/// number on the dashboard is always one tap from the clinics that produced it.
class MetricClinicsScreen extends ConsumerStatefulWidget {
  const MetricClinicsScreen({
    super.key,
    required this.metric,
    required this.scope,
  });

  final String metric;
  final DashboardScopeArgs scope;

  @override
  ConsumerState<MetricClinicsScreen> createState() =>
      _MetricClinicsScreenState();
}

class _MetricClinicsScreenState extends ConsumerState<MetricClinicsScreen> {
  int _page = 1;

  @override
  Widget build(BuildContext context) {
    // One instance, used by both the watch and the refresh: two constructions
    // could drift and leave pull-to-refresh invalidating a different page than
    // the one on screen.
    final args = MetricClinicsArgs(
      metric: widget.metric,
      scope: widget.scope,
      page: _page,
    );
    final repository = ref.watch(metricClinicsProvider(args));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(_metricTitles[widget.metric] ?? 'Clínicas')),
      body: RefreshIndicator(
        color: AppColors.navyBright,
        backgroundColor: Colors.white,
        strokeWidth: 2.6,
        onRefresh: () async => ref.invalidate(metricClinicsProvider(args)),
        child: RepositoryBuilder(
          repository: repository,
          builder: (context, page, repo) {
            if (page == null) {
              return const Center(child: CircularProgressIndicator());
            }
            if (page.data.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 32, vertical: 64),
                    child: Text(
                      'Nenhuma clínica neste recorte.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: Color(0xFF6b7280)),
                    ),
                  ),
                ],
              );
            }

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: page.data.length + 1,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                if (index == page.data.length) {
                  return _Pager(
                    page: page,
                    onChanged: (next) => setState(() => _page = next),
                  );
                }
                return _ClinicTile(
                  row: page.data[index],
                  verticalId: widget.scope.verticalId,
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _ClinicTile extends StatelessWidget {
  const _ClinicTile({required this.row, required this.verticalId});

  final DashboardClinicRow row;
  final int verticalId;

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      row.locationLabel,
      if (row.repName != null) row.repName!,
    ].where((s) => s.isNotEmpty).join(' · ');

    return ListTile(
      title: Text(row.name),
      subtitle: subtitle.isEmpty ? null : Text(subtitle),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: () => ClinicDetailRoute(
        id: row.facilityId,
        verticalId: verticalId,
      ).push(context),
    );
  }
}

class _Pager extends StatelessWidget {
  const _Pager({required this.page, required this.onChanged});

  final DashboardClinicPage page;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          TextButton(
            onPressed: page.page > 1 ? () => onChanged(page.page - 1) : null,
            child: const Text('Anterior'),
          ),
          Text(
            '${page.data.length} de ${page.total}',
            style: const TextStyle(fontSize: 12, color: Color(0xFF6b7280)),
          ),
          TextButton(
            onPressed: page.hasMore ? () => onChanged(page.page + 1) : null,
            child: const Text('Próxima'),
          ),
        ],
      ),
    );
  }
}
