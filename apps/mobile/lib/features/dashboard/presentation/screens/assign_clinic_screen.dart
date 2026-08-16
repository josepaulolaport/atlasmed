import 'dart:async';

import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/clinic_assignment_repository.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/empty_state.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/search_bar_widget.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Give a rep a clinic (spec 0015 R6).
///
/// Two doors. The default lists the free clinics inside their own patches —
/// geometry already justifies those, so one tap is enough. The second searches
/// the whole linha and asks for a sentence, because assigning outside the patch
/// is I2's override (spec 0009 R2): supported, deliberate, and on the record.
///
/// Refusing the second door was the alternative and it is worse. The assign use
/// case's own comment names what would happen — a throwaway patch drawn around
/// the clinic, making the territory model permanently wrong to work around a
/// one-off.
class AssignClinicScreen extends ConsumerStatefulWidget {
  const AssignClinicScreen({super.key, required this.userId, this.memberName});

  final int userId;
  final String? memberName;

  @override
  ConsumerState<AssignClinicScreen> createState() => _AssignClinicScreenState();
}

class _AssignClinicScreenState extends ConsumerState<AssignClinicScreen> {
  final _repository = ClinicAssignmentRepository();
  Timer? _debounce;

  bool _searchMode = false;

  /// What is typed right now.
  String _searchInput = '';

  /// What the last request was made with.
  String _search = '';
  bool _loading = true;
  String? _error;
  List<AssignableClinic> _rows = const [];
  int _total = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final verticalId = ref.read(dashboardSelectedVerticalIdProvider);
    if (verticalId == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await _repository.listAssignable(
        userId: widget.userId,
        verticalId: verticalId,
        searchMode: _searchMode,
        search: _search,
      );
      if (!mounted) return;
      setState(() {
        _rows = page.data;
        _total = page.total;
        _loading = false;
      });
    } on ClinicAssignmentException catch (error) {
      if (!mounted) return;
      // Stated, never swallowed: an empty list and a failed request look
      // identical on screen, and only one of them means "nothing to assign".
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  void _onSearchChanged(String value) {
    setState(() => _searchInput = value);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() => _search = value);
      _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Associar clínica')),
      body: Column(
        children: [
          _DoorSelector(
            searchMode: _searchMode,
            onChanged: (value) {
              setState(() {
                _searchMode = value;
                _search = '';
                _searchInput = '';
                _rows = const [];
                _total = 0;
              });
              _load();
            },
          ),
          if (_searchMode)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              // The same search field Explorar uses. This had its own, a
              // shorter dense TextField with a different radius and border.
              child: SearchBarWidget(
                value: _searchInput,
                onChanged: _onSearchChanged,
                hintText: 'Buscar clínica por nome',
                autofocus: true,
              ),
            ),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return _Message(
        icon: Icons.error_outline_rounded,
        title: 'Não foi possível carregar',
        detail: _error!,
        action: ('Tentar de novo', _load),
      );
    }
    if (_searchMode && _search.trim().isEmpty) {
      // The API refuses an untermed search on purpose — it scans the whole
      // linha — and "every clinic" is not a list anyone asked for anyway.
      return const _Message(
        icon: Icons.search_rounded,
        title: 'Busque uma clínica',
        detail:
            'Digite parte do nome. Fora dos patches, a atribuição pede um motivo.',
      );
    }
    if (_rows.isEmpty) {
      // Explorar's empty state. Searching the whole linha and finding nothing
      // is the same event here as there, and it should not look different.
      return _searchMode
          ? EmptyState(query: _search, kind: 'clinic')
          : const _Message(
              icon: Icons.check_circle_outline_rounded,
              title: 'Nenhuma clínica livre no território',
              detail:
                  'Todas as clínicas dentro dos patches já têm representante. '
                  'Use "Todas" para atribuir fora do território.',
            );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: _rows.length + 1,
      itemBuilder: (context, index) {
        if (index == _rows.length) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Text(
              _total > _rows.length
                  ? '${_rows.length} de $_total'
                  : '$_total ${_total == 1 ? 'clínica' : 'clínicas'}',
              style: const TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
          );
        }
        final clinic = _rows[index];
        // Explorar's row, not a private copy of it. `/assignable` returns no
        // doctor count and no clinical focus, so this is the summary form —
        // same tile, name, location line and divider, minus the meta it would
        // otherwise have had to invent.
        return ClinicRow.summary(
          name: clinic.name,
          location: clinic.locationLabel,
          badges: [
            if (clinic.currentRepName != null)
              _Tag(
                icon: Icons.person_outline_rounded,
                label: 'Com ${clinic.currentRepName}',
                color: AppColors.gray500,
              ),
            if (clinic.requiresReason)
              const _Tag(
                icon: Icons.explore_off_outlined,
                label: 'Fora do território',
                color: AppColors.amber,
              ),
          ],
          trailing: const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Icon(
              Icons.add_circle_outline_rounded,
              size: 20,
              color: AppColors.navyBright,
            ),
          ),
          onTap: () => _confirm(clinic),
        );
      },
    );
  }

  Future<void> _confirm(AssignableClinic clinic) async {
    final decision = await showDialog<_AssignDecision>(
      context: context,
      builder: (context) => _ConfirmAssignDialog(
        clinic: clinic,
        memberName: widget.memberName ?? 'este representante',
      ),
    );
    if (decision == null || !mounted) return;

    final verticalId = ref.read(dashboardSelectedVerticalIdProvider);
    if (verticalId == null) return;

    try {
      await _repository.assign(
        facilityId: clinic.facilityId,
        verticalId: verticalId,
        userId: widget.userId,
        overrideReason: decision.reason,
      );
      if (!mounted) return;
      // Spec 0015 R13: the roster row, the profile count and the map all read
      // this assignment.
      invalidateAssignmentDerivedData(ref);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("${clinic.name} associada.")));
      await _load();
    } on ClinicAssignmentException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }
}

class _AssignDecision {
  const _AssignDecision(this.reason);

  /// Null when the patch covers the clinic and geometry is justification enough.
  final String? reason;
}

/// Which door. Named for what they do rather than for the model behind them.
class _DoorSelector extends StatelessWidget {
  const _DoorSelector({required this.searchMode, required this.onChanged});

  final bool searchMode;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      child: SegmentedButton<bool>(
        segments: const [
          ButtonSegment(value: false, label: Text('No território')),
          ButtonSegment(value: true, label: Text('Todas')),
        ],
        selected: {searchMode},
        showSelectedIcon: false,
        onSelectionChanged: (values) => onChanged(values.first),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.icon, required this.label, required this.color});

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
      ],
    );
  }
}

/// The confirmation, which does three jobs at once: names who currently holds
/// the clinic, warns when the assignment is outside the patch, and collects the
/// reason that makes it legal.
class _ConfirmAssignDialog extends StatefulWidget {
  const _ConfirmAssignDialog({required this.clinic, required this.memberName});

  final AssignableClinic clinic;
  final String memberName;

  @override
  State<_ConfirmAssignDialog> createState() => _ConfirmAssignDialogState();
}

class _ConfirmAssignDialogState extends State<_ConfirmAssignDialog> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final clinic = widget.clinic;
    final needsReason = clinic.requiresReason;
    final canConfirm = !needsReason || _reason.text.trim().isNotEmpty;

    return AlertDialog(
      title: Text(
        needsReason ? 'Atribuir fora do território' : 'Associar clínica',
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Associar ${clinic.name} a ${widget.memberName}.',
            style: const TextStyle(fontSize: 13.5, height: 1.35),
          ),
          // Taking over ends someone else's assignment, so the dialog says
          // whose. Discovering it afterwards is how a manager loses a clinic
          // they did not know they had.
          if (clinic.currentRepName != null) ...[
            const SizedBox(height: 10),
            Text(
              'Atualmente com ${clinic.currentRepName}. '
              'A atribuição atual será encerrada.',
              style: const TextStyle(
                fontSize: 12.5,
                height: 1.35,
                color: AppColors.gray500,
              ),
            ),
          ],
          if (needsReason) ...[
            const SizedBox(height: 14),
            const Text(
              'Nenhum patch desta pessoa cobre esta clínica. '
              'A atribuição fica registrada com o motivo.',
              style: TextStyle(
                fontSize: 12.5,
                height: 1.35,
                color: AppColors.gray500,
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _reason,
              autofocus: true,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'Motivo',
                hintText: 'Ex.: cliente histórico do representante',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: canConfirm
              ? () => Navigator.of(
                  context,
                ).pop(_AssignDecision(needsReason ? _reason.text.trim() : null))
              : null,
          child: const Text('Associar'),
        ),
      ],
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.title,
    required this.detail,
    this.action,
  });

  final IconData icon;
  final String title;
  final String detail;
  final (String, VoidCallback)? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 30, color: AppColors.gray500),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              detail,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.gray500,
                height: 1.35,
              ),
            ),
            if (action != null) ...[
              const SizedBox(height: 14),
              FilledButton(onPressed: action!.$2, child: Text(action!.$1)),
            ],
          ],
        ),
      ),
    );
  }
}
