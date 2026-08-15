import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/clinic_assignment_repository.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
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
  'cpf-missing': 'Sem CPF cadastrado',
  'cpf-invalid': 'CPF inválido',
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
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  /// Turning a page starts it at the top.
  ///
  /// The list kept its offset across a page change, and the only control that
  /// changes pages sits at the very bottom — so tapping "Próxima" left you
  /// exactly where you already were, at the end of a list that had silently
  /// become a different one. On a 25-row page that hid the first sixteen rows
  /// of every page after the first, and the screen looked like it had simply
  /// scrolled a little.
  void _goToPage(int next) {
    setState(() => _page = next);
    if (!_scrollController.hasClients) return;
    _scrollController.jumpTo(0);
  }

  /// Built on first use. A read-only breakdown never mutates anything, and
  /// constructing the client eagerly starts an HTTP stack the screen may have
  /// no use for.
  late final _assignments = ClinicAssignmentRepository();

  Future<void> _dissociate(FacilityEntry row, MetricClinicsArgs args) async {
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
        facilityId: row.id,
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
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: page.data.length + 1,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                if (index == page.data.length) {
                  return _Pager(page: page, onChanged: _goToPage);
                }
                final clinic = page.data[index];
                return _BreakdownRow(
                  clinic: clinic,
                  verticalId: widget.scope.verticalId,
                  manageForName: widget.manageForUserId == null
                      ? null
                      : widget.manageForName,
                  onDissociate: widget.manageForUserId == null
                      ? null
                      : () => _dissociate(clinic, args),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// Explorar's clinic row, with the one control this screen adds to it.
///
/// This used to be a private re-implementation of [ClinicRow] — same 44px tile,
/// same 15/w600 title, and none of the médicos count, foco clínico chips or
/// status chips that make Explorar's row what it is. Two rows for one thing,
/// and the copy quietly fell behind. A clinic list reached from Desempenho is
/// the same list reached from Explorar, so it is now literally the same widget.
class _BreakdownRow extends StatelessWidget {
  const _BreakdownRow({
    required this.clinic,
    required this.verticalId,
    this.manageForName,
    this.onDissociate,
  });

  final FacilityEntry clinic;
  final int verticalId;
  final String? manageForName;
  final VoidCallback? onDissociate;

  @override
  Widget build(BuildContext context) {
    void open() =>
        ClinicDetailRoute(id: clinic.id, verticalId: verticalId).push(context);

    return ClinicRow(
      clinic: clinic,
      onTap: open,
      // An overflow menu rather than a swipe: discoverable, and it does not
      // fight the list's own scrolling.
      trailing: onDissociate == null
          ? null
          : PopupMenuButton<String>(
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
            // The range, not the page size. It read "25 de 146" on page one and
            // "25 de 146" on page two, so the one control that says where you
            // are said the same thing everywhere — and on a 146-clinic list
            // the only way to tell pages apart was to recognise the names.
            '${page.firstRowNumber}–${page.lastRowNumber} de ${page.total}',
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
