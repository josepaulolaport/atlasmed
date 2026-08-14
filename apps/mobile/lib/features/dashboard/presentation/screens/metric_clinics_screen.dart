import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/clinic_assignment_repository.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
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

  /// Built on first use. A read-only breakdown never mutates anything, and
  /// constructing the client eagerly starts an HTTP stack the screen may have
  /// no use for.
  late final _assignments = ClinicAssignmentRepository();

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
      // Spec 0015 R13: the profile count, the roster row and every Desempenho
      // card read the same assignment, so refreshing this list alone would
      // leave the rest of the app stating a figure that is no longer true.
      invalidateAssignmentDerivedData(ref);
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

  /// Built to match `ClinicRow` in Explorar rather than as a bare `ListTile`:
  /// the same bordered row, 44px rounded icon tile, 15/w600 title and icon-led
  /// meta. Two lists of clinics in one app should not look like they came from
  /// different products.
  @override
  Widget build(BuildContext context) {
    void open() => ClinicDetailRoute(
      id: row.facilityId,
      verticalId: verticalId,
    ).push(context);

    return InkWell(
      onTap: open,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.blue100, AppColors.blueLight],
                ),
              ),
              child: const Icon(
                Icons.local_hospital_rounded,
                size: 22,
                color: AppColors.navyBright,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    row.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (row.locationLabel.isNotEmpty)
                        _RowMeta(
                          icon: Icons.place_outlined,
                          text: row.locationLabel,
                        ),
                      if (row.repName != null)
                        _RowMeta(
                          icon: Icons.person_outline_rounded,
                          text: row.repName!,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // An overflow menu rather than a swipe: discoverable, and it does
            // not fight the list's own scrolling.
            if (onDissociate == null)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.gray500,
                ),
              )
            else
              PopupMenuButton<String>(
                icon: const Icon(
                  Icons.more_horiz_rounded,
                  size: 20,
                  color: AppColors.gray500,
                ),
                onSelected: (value) {
                  if (value == 'open') open();
                  if (value == 'dissociate') onDissociate!();
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'open',
                    child: Text('Ver clínica'),
                  ),
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
          ],
        ),
      ),
    );
  }
}

/// One icon-led fact under a clinic's name — the shape Explorar's rows use.
class _RowMeta extends StatelessWidget {
  const _RowMeta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AppColors.gray500),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
              color: AppColors.gray500,
            ),
          ),
        ),
      ],
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
