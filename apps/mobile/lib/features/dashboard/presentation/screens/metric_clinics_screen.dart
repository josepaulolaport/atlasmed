import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/clinic_assignment_repository.dart';
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
    this.manageForUserId,
    this.manageForName,
  });

  final String metric;
  final DashboardScopeArgs scope;

  /// Set when this list is *someone's* clinics rather than a metric breakdown
  /// (spec 0015 §4.2). It is what turns rows into things you can act on: the
  /// `⋯` menu, and the way to hand a clinic back.
  ///
  /// A breakdown of "cobertura" is a population, not a person's caseload, so it
  /// deliberately has no menu — desassociar there would beg the question of
  /// whom you were unassigning.
  final int? manageForUserId;
  final String? manageForName;

  @override
  ConsumerState<MetricClinicsScreen> createState() =>
      _MetricClinicsScreenState();
}

class _MetricClinicsScreenState extends ConsumerState<MetricClinicsScreen> {
  int _page = 1;
  final _assignments = ClinicAssignmentRepository();

  Future<void> _dissociate(
    DashboardClinicRow row,
    MetricClinicsArgs args,
  ) async {
    final reason = await showDialog<UnassignReason>(
      context: context,
      builder: (context) => _DissociateDialog(
        clinicName: row.name,
        memberName: widget.manageForName,
      ),
    );
    if (reason == null || !mounted) return;

    try {
      await _assignments.unassign(
        facilityId: row.facilityId,
        verticalId: widget.scope.verticalId,
        reason: reason,
      );
      if (!mounted) return;
      // Spec 0015 R13: the count on the profile and the roster row derive from
      // this same assignment, so the list alone is not enough to refresh.
      ref.invalidate(metricClinicsProvider(args));
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('${row.name} desassociada.')));
    } on ClinicAssignmentException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

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
                  manageForName: widget.manageForUserId == null
                      ? null
                      : widget.manageForName,
                  onDissociate: widget.manageForUserId == null
                      ? null
                      : () => _dissociate(page.data[index], args),
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
  const _ClinicTile({
    required this.row,
    required this.verticalId,
    this.manageForName,
    this.onDissociate,
  });

  final DashboardClinicRow row;
  final int verticalId;
  final String? manageForName;
  final VoidCallback? onDissociate;

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      row.locationLabel,
      if (row.repName != null) row.repName!,
    ].where((s) => s.isNotEmpty).join(' · ');

    void open() => ClinicDetailRoute(
      id: row.facilityId,
      verticalId: verticalId,
    ).push(context);

    return ListTile(
      title: Text(row.name),
      subtitle: subtitle.isEmpty ? null : Text(subtitle),
      // An overflow menu rather than a swipe: discoverable, and it does not
      // fight the list's own scrolling.
      trailing: onDissociate == null
          ? const Icon(Icons.chevron_right_rounded)
          : PopupMenuButton<String>(
              icon: const Icon(Icons.more_horiz_rounded),
              onSelected: (value) {
                if (value == 'open') open();
                if (value == 'dissociate') onDissociate!();
              },
              itemBuilder: (context) => [
                const PopupMenuItem(value: 'open', child: Text('Ver clínica')),
                PopupMenuItem(
                  value: 'dissociate',
                  child: Text(
                    manageForName == null
                        ? 'Desassociar'
                        : 'Desassociar de $manageForName',
                  ),
                ),
              ],
            ),
      onTap: open,
    );
  }
}

/// The motivo, chosen from a fixed list (spec 0015 R7).
///
/// Free text was the alternative and the wrong one: `end_reason` is kept
/// forever (I5) and is the only account of why a clinic left a rep, so churn
/// that cannot be aggregated is churn that cannot be explained later.
class _DissociateDialog extends StatefulWidget {
  const _DissociateDialog({required this.clinicName, required this.memberName});

  final String clinicName;
  final String? memberName;

  @override
  State<_DissociateDialog> createState() => _DissociateDialogState();
}

class _DissociateDialogState extends State<_DissociateDialog> {
  UnassignReason _reason = UnassignReason.repChanged;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Desassociar clínica'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.memberName == null
                ? '${widget.clinicName} deixará de ter representante.'
                : '${widget.clinicName} deixará de estar com ${widget.memberName}.',
            style: const TextStyle(fontSize: 13.5, height: 1.35),
          ),
          const SizedBox(height: 12),
          const Text(
            'Motivo',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.gray500,
            ),
          ),
          RadioGroup<UnassignReason>(
            groupValue: _reason,
            onChanged: (value) => setState(() => _reason = value!),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final reason in UnassignReason.values)
                  RadioListTile<UnassignReason>(
                    value: reason,
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      reason.label,
                      style: const TextStyle(fontSize: 13.5),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_reason),
          child: const Text('Desassociar'),
        ),
      ],
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
