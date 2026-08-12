import 'dart:async';

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/cnes_suggestions.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Search + multi-select doctors to associate with a facility.
/// Returns the selected doctors (already-associated + newly picked).
Future<List<ProfessionalRoster>?> showAssociateDoctorsSheet(
  BuildContext context, {
  required Set<int> alreadyAssociatedIds,
  required List<ProfessionalRoster> alreadyAssociatedDoctors,
  int? facilityId,
}) {
  return showModalBottomSheet<List<ProfessionalRoster>>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _AssociateDoctorsSheet(
      alreadyAssociatedIds: alreadyAssociatedIds,
      alreadyAssociatedDoctors: alreadyAssociatedDoctors,
      facilityId: facilityId,
    ),
  );
}

enum _DoctorSource { ours, cnes }

class _AssociateDoctorsSheet extends StatefulWidget {
  const _AssociateDoctorsSheet({
    required this.alreadyAssociatedIds,
    required this.alreadyAssociatedDoctors,
    this.facilityId,
  });

  final Set<int> alreadyAssociatedIds;
  final List<ProfessionalRoster> alreadyAssociatedDoctors;
  final int? facilityId;

  @override
  State<_AssociateDoctorsSheet> createState() => _AssociateDoctorsSheetState();
}

class _AssociateDoctorsSheetState extends State<_AssociateDoctorsSheet> {
  List<ProfessionalRoster> _pool = const [];
  final Set<int> _selected = {};
  String _query = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;
  Timer? _debounce;

  /// CNES-sourced suggestions for this clinic (spec 0012 §5).
  ///
  /// Fetched once on open rather than per keystroke: the set does not depend on
  /// the search query, and it changes only when the registry is reloaded.
  CnesSuggestions? _cnes;

  /// Which source the list is showing.
  ///
  /// A switch rather than stacked sections: the two answer different questions —
  /// "who is in our base" versus "who does CNES place here" — and stacking them
  /// buried the CNES list under a search pool that can run to dozens of rows.
  /// Selection is deliberately shared across both, so a rep can pick from either
  /// and save once.
  _DoctorSource _source = _DoctorSource.ours;

  /// People the server reports as already linked here, from the CNES view.
  ///
  /// Kept beside `alreadyAssociatedIds` rather than merged into it: that set is
  /// the caller's, and `_confirm` uses both to decide who actually needs an
  /// association request.
  final Set<int> _cnesLinkedIds = {};

  /// Cached copy of already-associated doctors for pinning at the top.
  List<ProfessionalRoster> get _associated => widget.alreadyAssociatedDoctors;

  bool get _useApi {
    final id = widget.facilityId;
    return id != null && id > 0;
  }

  @override
  void initState() {
    super.initState();
    _selected.addAll(widget.alreadyAssociatedIds);
    _loadPool();
    _loadCnesSuggestions();
  }

  /// Never throws into the sheet: a CNES outage must not stop someone
  /// associating a doctor by hand, so a failure degrades to an explanatory
  /// section rather than an error state over the whole surface.
  Future<void> _loadCnesSuggestions() async {
    if (!_useApi) return;
    final repo = FacilityAssociateRepository(widget.facilityId!);
    try {
      final suggestions = await repo.fetchCnesSuggestions();
      if (!mounted) return;
      setState(() {
        _cnes = suggestions;
        // The server's notion of "linked here" is authoritative and can be wider
        // than the caller's `alreadyAssociatedIds`. Without this they would
        // render unchecked in a section titled "já associados", and — worse —
        // `_confirm` would post an association for someone already associated.
        _cnesLinkedIds
          ..clear()
          ..addAll(suggestions.linked.map((s) => s.personId));
        _selected.addAll(_cnesLinkedIds);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _cnes = CnesSuggestions.unavailable());
    } finally {
      repo.dispose();
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadPool({String? search}) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (!_useApi) {
        if (!mounted) return;
        setState(() {
          _pool = const [];
          _loading = false;
          _error = 'Estabelecimento inválido.';
        });
        return;
      }

      final repo = FacilityAssociateRepository(widget.facilityId!);
      try {
        final pool = await repo.searchDoctors(search: search);
        // Merge pool with already-associated doctors (search may not
        // return them since they're already linked to this facility).
        final merged = <ProfessionalRoster>[...pool];
        for (final d in _associated) {
          if (!merged.any((m) => m.id == d.id)) {
            merged.add(d);
          }
        }
        if (!mounted) return;
        setState(() {
          _pool = merged;
          _loading = false;
        });
      } finally {
        repo.dispose();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
        _pool = const [];
      });
    }
  }

  void _onQueryChanged(String q) {
    setState(() => _query = q);
    if (!_useApi) return;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _loadPool(search: q.trim().isEmpty ? null : q.trim());
    });
  }

  List<ProfessionalRoster> get _filtered => _pool;

  /// CNES rows for people not already linked here, matching the current search.
  ///
  /// No longer deduplicated against the search pool. With the two sources on
  /// separate tabs they answer different questions, and a doctor who is both in
  /// our base and placed here by CNES belongs on both — the shared selection
  /// keeps the two views consistent.
  ///
  /// Filtered locally because the list is one bounded fetch rather than a query:
  /// searching while on this tab should narrow what is in front of you, not sit
  /// inert.
  bool _matchesQuery(CnesSuggestion s) {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return true;
    return s.displayName.toLowerCase().contains(query) ||
        (s.occupation ?? '').toLowerCase().contains(query) ||
        (s.registrationLabel ?? '').toLowerCase().contains(query);
  }

  /// CNES places them here and they are not linked yet — the actionable half.
  List<CnesSuggestion> get _cnesRows {
    final suggestions = _cnes;
    if (suggestions == null) return const [];
    return suggestions.unlinked
        .where((s) => !widget.alreadyAssociatedIds.contains(s.personId))
        .where(_matchesQuery)
        .toList(growable: false);
  }

  /// CNES places them here and we already have them linked.
  ///
  /// Shown on this tab because the question it answers is about the snapshot —
  /// how much of what CNES records here do we already cover — which our own
  /// roster cannot say.
  List<CnesSuggestion> get _cnesLinkedRows {
    final suggestions = _cnes;
    if (suggestions == null) return const [];
    return suggestions.linked.where(_matchesQuery).toList(growable: false);
  }

  /// Combined items list with section headers for the list view.
  /// Items are [String] markers, [ProfessionalRoster] rows, or [CnesSuggestion]
  /// rows.
  List<Object> get _sectionedItems {
    final fd = _filtered;

    final associated = fd
        .where((d) => widget.alreadyAssociatedIds.contains(d.id))
        .toList();
    final available = fd
        .where((d) => !widget.alreadyAssociatedIds.contains(d.id))
        .toList();
    final cnes = _cnesRows;

    final items = <Object>[];

    if (_source == _DoctorSource.cnes) {
      final linked = _cnesLinkedRows;
      if (linked.isNotEmpty) {
        items.add('_section_header_associated');
        items.addAll(linked);
        items.add('_section_divider');
      }

      if (cnes.isEmpty) {
        items.add('_section_cnes_empty');
      } else {
        items.add('_section_header_cnes_new');
        items.addAll(cnes);
      }
      return items;
    }

    if (associated.isNotEmpty) {
      items.add('_section_header_associated');
      items.addAll(associated);
    }
    if (available.isNotEmpty) {
      if (items.isNotEmpty) items.add('_section_divider');
      items.add('_section_header_available');
      items.addAll(available);
    }
    return items;
  }

  Widget _buildSectionHeader(String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppColors.gray500,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height * 0.88;
    final filtered = _filtered;

    return SizedBox(
      height: height,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: AppColors.gray200,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                const Text(
                  'Associar médicos',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Busque e selecione médicos para vincular a esta clínica.',
                  style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
                ),
                const SizedBox(height: 14),
                _ModalSearchField(
                  value: _query,
                  hintText: 'Buscar médico, especialidade, CRM…',
                  onChanged: _onQueryChanged,
                ),
                const SizedBox(height: 12),
                _SourceToggle(
                  source: _source,
                  // Everyone CNES places here, linked or not — the pill counts
                  // what the tab contains rather than only the actionable part,
                  // so the number matches the rows below it.
                  cnesCount: _cnesRows.length + _cnesLinkedRows.length,
                  // Null until the fetch settles, so the pill can say "—"
                  // rather than claim zero before it knows.
                  cnesLoaded: _cnes != null,
                  onChanged: (next) => setState(() => _source = next),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'Não foi possível carregar médicos.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13.5,
                              color: AppColors.gray400,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextButton(
                            onPressed: () => _loadPool(
                              search: _query.trim().isEmpty
                                  ? null
                                  : _query.trim(),
                            ),
                            child: const Text('Tentar novamente'),
                          ),
                        ],
                      ),
                    ),
                  )
                // Not `filtered.isEmpty`: the CNES section can have rows when
                // the search pool has none, and short-circuiting on the pool
                // alone hid the suggestions exactly when they were the only
                // thing to show.
                : _sectionedItems.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        _query.isEmpty
                            ? 'Nenhum médico disponível para associar. Crie um perfil abaixo.'
                            : 'Nada encontrado para "$_query". Tente outro termo ou crie um perfil.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13.5,
                          color: AppColors.gray400,
                          height: 1.4,
                        ),
                      ),
                    ),
                  )
                : _buildDoctorList(filtered, _sectionedItems),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(
              16,
              12,
              16,
              12 + MediaQuery.paddingOf(context).bottom,
            ),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.gray200)),
              color: Colors.white,
            ),
            child: Column(
              children: [
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _selected.isEmpty || _saving ? null : _confirm,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.navyBright,
                      disabledBackgroundColor: AppColors.gray200,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            _selected.isEmpty
                                ? 'Associar'
                                : 'Associar (${_selected.length})',
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDoctorList(
    List<ProfessionalRoster> filtered,
    List<Object> sectioned,
  ) {
    return ListView.builder(
      itemCount: sectioned.length,
      itemBuilder: (_, i) {
        final item = sectioned[i];
        // Section header
        if (item is String) {
          switch (item) {
            case '_section_header_associated':
              return _buildSectionHeader('Já associados');
            case '_section_header_available':
              return _buildSectionHeader('Disponíveis');
            case '_section_header_cnes_new':
              // The competence rides here rather than on its own line: it
              // qualifies these rows, and it is the reason ADR 0006's accepted
              // staleness risk is retired.
              final reference = _cnes?.referenceShort;
              return _buildSectionHeader(
                reference == null
                    ? 'Sugeridos pelo CNES'
                    : 'Sugeridos pelo CNES (dados $reference)',
              );
            case '_section_cnes_empty':
              return Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Text(
                  _cnes?.emptyMessage ?? '',
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.gray400,
                    height: 1.4,
                  ),
                ),
              );
            case '_section_divider':
              return const Divider(
                height: 12,
                indent: 20,
                endIndent: 20,
                color: AppColors.gray200,
              );
          }
          return const SizedBox.shrink();
        }

        // A CNES suggestion renders through the same tile as everything else —
        // same avatar, same type scale, same subtitle rule — because two
        // builders for one row shape is how they end up looking different.
        if (item is CnesSuggestion) return _buildPersonTile(item.toRoster());

        return _buildPersonTile(item as ProfessionalRoster);
      },
    );
  }

  Widget _buildPersonTile(ProfessionalRoster d) {
    {
      final selected = _selected.contains(d.id);
      // Includes people the server reports as linked here, so unchecking one on
      // the CNES tab offers the same undo as anywhere else rather than silently
      // dropping a real association.
      final isAssociated =
          widget.alreadyAssociatedIds.contains(d.id) ||
          _cnesLinkedIds.contains(d.id);
      return CheckboxListTile(
        value: selected,
        onChanged: _saving
            ? null
            : (v) {
                if (v == false && isAssociated) {
                  setState(() => _selected.remove(d.id));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      duration: const Duration(seconds: 4),
                      content: Text('${d.name} removido'),
                      action: SnackBarAction(
                        label: 'Desfazer',
                        onPressed: () {
                          setState(() => _selected.add(d.id));
                        },
                      ),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                } else {
                  setState(() {
                    if (v == true) {
                      _selected.add(d.id);
                    } else {
                      _selected.remove(d.id);
                    }
                  });
                }
              },
        controlAffinity: ListTileControlAffinity.trailing,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
        secondary: CircleAvatar(
          backgroundColor: HSLColor.fromAHSL(1, d.hue, 0.48, 0.88).toColor(),
          child: Text(
            d.initials,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: HSLColor.fromAHSL(1, d.hue, 0.55, 0.32).toColor(),
            ),
          ),
        ),
        title: Text(
          d.name,
          style: const TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w600,
            color: AppColors.gray900,
          ),
        ),
        subtitle: Text(
          [
            if (d.specialty != null) d.specialty!,
            if (d.crm != null) d.crm!,
          ].join(' · '),
          style: const TextStyle(fontSize: 12, color: AppColors.gray500),
        ),
        activeColor: AppColors.navyBright,
      );
    }
  }

  Future<void> _confirm() async {
    // Candidates come from the pool AND the CNES section. A suggestion is
    // deliberately absent from the pool — the server excludes people already
    // linked here, and the search knows nothing about the registry. Selecting
    // from `_pool` alone silently dropped every suggestion on save: the
    // checkbox ticked, the sheet closed, and nothing was associated.
    final candidates = <int, ProfessionalRoster>{
      for (final suggestion in _cnesRows)
        suggestion.personId: suggestion.toRoster(),
      // Pool entries win on conflict: they carry the richer roster data.
      for (final doctor in _pool) doctor.id: doctor,
    };
    final chosen = candidates.values
        .where((d) => _selected.contains(d.id))
        .toList(growable: false);
    if (chosen.isEmpty || !_useApi) return;
    // Everyone the server already counts as linked here, from either source.
    // `alreadyAssociatedIds` alone is the caller's view and can be narrower, and
    // posting an association for someone already associated is a write nobody
    // asked for.
    final alreadyLinked = <int>{
      ...widget.alreadyAssociatedIds,
      ..._cnesLinkedIds,
    };

    // Associate existing persons only (POST { personId }).
    setState(() => _saving = true);
    final repo = FacilityAssociateRepository(widget.facilityId!);
    try {
      // Only call associate for doctors not already linked — already-
      // associated ones are pre-checked and don't need an API call.
      final newlySelected = chosen
          .where((d) => !alreadyLinked.contains(d.id))
          .toList();
      final associated = <ProfessionalRoster>[];
      for (final doctor in newlySelected) {
        await repo.associateDoctor(doctor.id);
        associated.add(doctor);
      }
      if (!mounted) return;
      Navigator.of(context).pop(associated);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is FacilityAssociateException
                ? (e.message ?? 'Falha ao associar')
                : 'Falha ao associar médicos',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      repo.dispose();
    }
  }
}

/// Switches the list between our own base and what CNES records at this clinic.
class _SourceToggle extends StatelessWidget {
  const _SourceToggle({
    required this.source,
    required this.cnesCount,
    required this.cnesLoaded,
    required this.onChanged,
  });

  final _DoctorSource source;
  final int cnesCount;
  final bool cnesLoaded;
  final ValueChanged<_DoctorSource> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.gray100,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            child: _SourceTab(
              label: 'Nossa base',
              selected: source == _DoctorSource.ours,
              onTap: () => onChanged(_DoctorSource.ours),
            ),
          ),
          Expanded(
            child: _SourceTab(
              label: cnesLoaded ? 'CNES ($cnesCount)' : 'CNES',
              selected: source == _DoctorSource.cnes,
              onTap: () => onChanged(_DoctorSource.cnes),
            ),
          ),
        ],
      ),
    );
  }
}

class _SourceTab extends StatelessWidget {
  const _SourceTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            boxShadow: selected
                ? const [
                    BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 4,
                      offset: Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: selected ? AppColors.gray900 : AppColors.gray500,
            ),
          ),
        ),
      ),
    );
  }
}

class _ModalSearchField extends StatefulWidget {
  const _ModalSearchField({
    required this.value,
    required this.hintText,
    required this.onChanged,
  });

  final String value;
  final String hintText;
  final ValueChanged<String> onChanged;

  @override
  State<_ModalSearchField> createState() => _ModalSearchFieldState();
}

class _ModalSearchFieldState extends State<_ModalSearchField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
  }

  @override
  void didUpdateWidget(covariant _ModalSearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.surfaceTertiary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.gray200),
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          const Icon(Icons.search_rounded, size: 18, color: AppColors.gray500),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _controller,
              onChanged: widget.onChanged,
              decoration: InputDecoration(
                hintText: widget.hintText,
                hintStyle: const TextStyle(color: AppColors.gray400),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
              style: const TextStyle(fontSize: 14, color: AppColors.gray900),
            ),
          ),
          if (widget.value.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.close_rounded, size: 18),
              color: AppColors.gray500,
              onPressed: () => widget.onChanged(''),
            ),
        ],
      ),
    );
  }
}
