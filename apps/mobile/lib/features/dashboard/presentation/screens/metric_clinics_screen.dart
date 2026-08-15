import 'dart:async';

import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/clinic_assignment_repository.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/unassign_reason_dialog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/explore_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/search_bar_widget.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/skeleton_row.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
// `Left` only — dartz also exports a `State` that collides with Flutter's.
import 'package:dartz/dartz.dart' show Left;
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
  /// Built on first use. A read-only breakdown never mutates anything, and
  /// constructing the client eagerly starts an HTTP stack the screen may have
  /// no use for.
  late final _assignments = ClinicAssignmentRepository();

  Future<void> _dissociate(FacilityEntry row) async {
    final reason = await UnassignReasonDialog.show(
      context,
      clinicName: row.name,
      memberName: widget.manageForName,
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
    final args = MetricClinicsListArgs(
      metric: widget.metric,
      scope: widget.scope,
    );
    final state = ref.watch(metricClinicsListProvider(args));
    final notifier = ref.read(metricClinicsListProvider(args).notifier);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(_metricTitles[widget.metric] ?? 'Clínicas')),
      body: Column(
        children: [
          // Explorar's own search bar, with no filter button: the recorte was
          // already chosen by the card that opened this list, and a second set
          // of filters here would quietly disagree with it.
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
            child: SearchBarWidget(
              value: state.query,
              onChanged: notifier.setQuery,
              hintText: 'Buscar clínica, bairro…',
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: _CountLabel(
                total: state.total,
                loaded: state.clinics.length,
                loading: state.loading,
              ),
            ),
          ),
          Expanded(child: _body(state, notifier)),
        ],
      ),
    );
  }

  Widget _body(
    MetricClinicsListState state,
    MetricClinicsListNotifier notifier,
  ) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return RefreshIndicator(
      color: AppColors.navyBright,
      backgroundColor: Colors.white,
      strokeWidth: 2.6,
      onRefresh: notifier.refresh,
      child: state.loading
          ? ListView.builder(
              itemCount: 8,
              itemBuilder: (_, _) => const SkeletonRow(),
            )
          : state.clinics.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 64,
                  ),
                  child: Text(
                    // The two empty states are different problems: an empty
                    // recorte is a fact about the metric, an empty search is a
                    // fact about what was typed.
                    state.query.trim().isEmpty
                        ? 'Nenhuma clínica neste recorte.'
                        : 'Nenhuma clínica encontrada para “${state.query.trim()}”.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.gray500,
                    ),
                  ),
                ),
              ],
            )
          : ExploreResultsList(
              items: [
                for (final clinic in state.clinics)
                  Left<FacilityEntry, ProfessionalEntry>(clinic),
              ],
              hasMore: state.hasMore,
              isLoadingMore: state.loadingMore,
              onLoadMore: () => unawaited(notifier.loadMore()),
              bottomInset: bottomInset,
              preferredVerticalId: widget.scope.verticalId,
              clinicTrailingBuilder: widget.manageForUserId == null
                  ? null
                  : (clinic) => _DissociateMenu(
                      memberName: widget.manageForName,
                      onOpen: () => ClinicDetailRoute(
                        id: clinic.id,
                        verticalId: widget.scope.verticalId,
                      ).push(context),
                      onDissociate: () => _dissociate(clinic),
                    ),
            ),
    );
  }
}

/// "1423 clínicas", and how many are loaded while more are coming.
///
/// Where Explorar puts its own result count, and reading the same way — this is
/// the size of the list, which the search narrows. The metric that opened the
/// list is the card on the screen behind, and it does not move.
class _CountLabel extends StatelessWidget {
  const _CountLabel({
    required this.total,
    required this.loaded,
    required this.loading,
  });

  final int total;
  final int loaded;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final label = loading
        ? 'Carregando…'
        : loaded >= total
        ? '$total clínica${total == 1 ? '' : 's'}'
        : '$loaded de $total clínicas';
    return Text(
      label,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AppColors.gray500,
      ),
    );
  }
}

/// The one control this screen adds to Explorar's row.
///
/// An overflow menu rather than a swipe: discoverable, and it does not fight
/// the list's own scrolling.
class _DissociateMenu extends StatelessWidget {
  const _DissociateMenu({
    required this.memberName,
    required this.onOpen,
    required this.onDissociate,
  });

  final String? memberName;
  final VoidCallback onOpen;
  final VoidCallback onDissociate;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: const Icon(
        Icons.more_horiz_rounded,
        size: 20,
        color: AppColors.gray500,
      ),
      onSelected: (value) {
        if (value == 'open') onOpen();
        if (value == 'dissociate') onDissociate();
      },
      itemBuilder: (context) => [
        const PopupMenuItem(value: 'open', child: Text('Ver clínica')),
        PopupMenuItem(
          value: 'dissociate',
          child: Text(
            memberName == null ? 'Desassociar' : 'Desassociar de $memberName',
          ),
        ),
      ],
    );
  }
}
