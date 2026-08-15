import 'dart:async';

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/cnes_suggestions.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/cnes_import_wizard.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Builds the repository the sheet talks through.
///
/// Exists so a test can supply one. The sheet used to construct its own with no
/// way in, which made every behaviour below — selection, import, the merge in
/// [_AssociateDoctorsSheetState._confirm] — unreachable from a widget test.
typedef FacilityAssociateRepositoryBuilder =
    FacilityAssociateRepository Function(int facilityId);

FacilityAssociateRepository _defaultRepository(int facilityId) =>
    FacilityAssociateRepository(facilityId);

/// Search + multi-select doctors to associate with a facility.
///
/// Returns the doctors the rep settled on — already-associated, newly picked,
/// and any imported from CNES along the way.
Future<List<ProfessionalRoster>?> showAssociateDoctorsSheet(
  BuildContext context, {
  required Set<int> alreadyAssociatedIds,
  required List<ProfessionalRoster> alreadyAssociatedDoctors,
  int? facilityId,
  FacilityAssociateRepositoryBuilder? repositoryBuilder,
}) {
  return showModalBottomSheet<List<ProfessionalRoster>>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => AssociateDoctorsSheet(
      alreadyAssociatedIds: alreadyAssociatedIds,
      alreadyAssociatedDoctors: alreadyAssociatedDoctors,
      facilityId: facilityId,
      repositoryBuilder: repositoryBuilder,
    ),
  );
}

enum _DoctorSource { ours, cnes }

/// Public only so widget tests can mount it without the modal route.
@visibleForTesting
class AssociateDoctorsSheet extends StatefulWidget {
  const AssociateDoctorsSheet({
    super.key,
    required this.alreadyAssociatedIds,
    required this.alreadyAssociatedDoctors,
    this.facilityId,
    this.repositoryBuilder,
    this.importCatalogues,
  });

  final Set<int> alreadyAssociatedIds;
  final List<ProfessionalRoster> alreadyAssociatedDoctors;
  final int? facilityId;
  final FacilityAssociateRepositoryBuilder? repositoryBuilder;

  /// Passed straight to the import wizard. Present only so a widget test can
  /// mount the wizard the sheet pushes without reaching the network for the
  /// specialty and role catalogues.
  final CnesImportCatalogues? importCatalogues;

  @override
  State<AssociateDoctorsSheet> createState() => _AssociateDoctorsSheetState();
}

class _AssociateDoctorsSheetState extends State<AssociateDoctorsSheet> {
  FacilityAssociateRepository _repository() =>
      (widget.repositoryBuilder ?? _defaultRepository)(widget.facilityId!);

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

  /// CNES professionals picked for import, keyed by SUS id.
  ///
  /// Separate from [_selected] because they have no person id yet — that is
  /// precisely what makes them an import rather than an association.
  final Set<String> _selectedCnesIds = {};

  /// The role catalogue, for the chips on a ticked row. Empty until it loads,
  /// and empty for good if it fails — a failed catalogue costs the chips, not
  /// the association.
  List<PersonFacilityRoleCatalogEntry> _roles = const [];

  /// Roles the rep picked, keyed by person id. Absent means they said nothing,
  /// which is a legitimate answer.
  final Map<int, Set<int>> _selectedRoles = {};

  List<int> _rolesFor(int personId) =>
      (_selectedRoles[personId] ?? const <int>{}).toList()..sort();

  /// What an association will record this person doing here.
  ///
  /// CNES's claim as it stands: associating is one tap on a row the rep is
  /// confirming, not a form. Editing which occupations get written belongs to
  /// the import wizard, where the rep is already filling in a profile.
  List<int> _occupationsFor(CnesSuggestion s) =>
      s.occupationOptions.map((o) => o.id).toList(growable: false);

  /// Everything the confirm button would act on, from both selection sets.
  ///
  /// Counting `_selected` alone left the button dead when the only things
  /// ticked were people to import — the rows that need the most work were the
  /// ones the sheet refused to act on.
  int get _selectionCount => _selected.length + _selectedCnesIds.length;

  /// Cached copy of already-associated doctors for pinning at the top.
  List<ProfessionalRoster> get _associated => widget.alreadyAssociatedDoctors;

  /// Doctors the rep un-ticked: linked when the sheet opened, not selected now.
  ///
  /// `_selected` starts as the already-associated set, so un-ticking one *is*
  /// the request to end that affiliation. The sheet used to answer it with a
  /// snackbar saying "removido" and then do nothing — there was no removal
  /// branch in `_confirm` at all, and with nothing left ticked the save button
  /// was disabled outright, so the removal could not even be attempted.
  ///
  /// Only doctors we hold a `personFacilityId` for: that id is what the DELETE
  /// addresses, and a CNES row the roster has never seen has no affiliation to
  /// end.
  List<ProfessionalRoster> get _pendingRemovals => _associated
      .where((d) => !_selected.contains(d.id) && d.personFacilityId != null)
      .toList(growable: false);

  /// What the button will actually do, rather than always saying "Associar".
  ///
  /// A rep who has only un-ticked somebody is about to remove, and a button
  /// labelled "Associar" is the wrong promise for that.
  String get _confirmLabel {
    final additions =
        _selected.difference(widget.alreadyAssociatedIds).length +
        _selectedCnesIds.length;
    final removals = _pendingRemovals.length;
    if (additions > 0 && removals > 0) {
      return 'Salvar ($additions +$removals −)';
    }
    if (removals > 0) return 'Remover ($removals)';
    if (additions > 0) return 'Associar ($additions)';
    return 'Associar';
  }

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
    _loadRoles();
  }

  /// Never throws into the sheet: without the catalogue the rep simply cannot
  /// pick a role here, which is the same position they were in before.
  Future<void> _loadRoles() async {
    try {
      final roles =
          await (widget.importCatalogues ?? defaultCnesImportCatalogues())
              .roles();
      if (!mounted) return;
      setState(() => _roles = PersonFacilityRoleCatalog.activeEntries(roles));
    } catch (_) {
      // Deliberately silent about the catalogue, loud about nothing else: the
      // sheet's job is associating, and it still does that.
    }
  }

  /// Never throws into the sheet: a CNES outage must not stop someone
  /// associating a doctor by hand, so a failure degrades to an explanatory
  /// section rather than an error state over the whole surface.
  Future<void> _loadCnesSuggestions() async {
    if (!_useApi) return;
    final repo = _repository();
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
          // `linked` implies we hold them, so personId is present — but read it
          // defensively rather than asserting: a null here would crash the whole
          // sheet on open, and the row it came from is simply not linkable.
          ..addAll(suggestions.linked.map((s) => s.personId).whereType<int>());
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

      final repo = _repository();
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

  /// CNES places them here, we hold them, and they are not linked yet.
  List<CnesSuggestion> get _cnesRows {
    final suggestions = _cnes;
    if (suggestions == null) return const [];
    return suggestions.unlinked
        .where((s) => !widget.alreadyAssociatedIds.contains(s.personId))
        .where(_matchesQuery)
        .toList(growable: false);
  }

  /// CNES places them here and our database has never heard of them.
  ///
  /// Their own section rather than mixed in: selecting one commits the rep to
  /// creating a professional record, which is a heavier thing than linking an
  /// existing one, and the row carries a chip saying so.
  List<CnesSuggestion> get _cnesUnknownRows {
    final suggestions = _cnes;
    if (suggestions == null) return const [];
    return suggestions.unknown.where(_matchesQuery).toList(growable: false);
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

      final unknown = _cnesUnknownRows;
      if (cnes.isEmpty && unknown.isEmpty) {
        items.add('_section_cnes_empty');
      } else {
        if (cnes.isNotEmpty) {
          items.add('_section_header_cnes_new');
          items.addAll(cnes);
        }
        if (unknown.isNotEmpty) {
          if (items.isNotEmpty) items.add('_section_divider');
          items.add('_section_header_cnes_unknown');
          items.addAll(unknown);
        }
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
                  cnesCount:
                      _cnesRows.length +
                      _cnesLinkedRows.length +
                      _cnesUnknownRows.length,
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
            /*
             * Both failure states are scoped to the tab that owns them.
             *
             * The pool and the CNES snapshot come from different places and
             * fail independently: a search outage used to blank this whole
             * surface, CNES tab included, so a working registry section was
             * unreachable because an unrelated request had failed. The reverse
             * was already true by design — a CNES outage degrades to a message
             * inside its own section.
             */
            child: _loading && _source == _DoctorSource.ours
                ? const Center(child: CircularProgressIndicator())
                : _error != null && _source == _DoctorSource.ours
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
                    // Enabled for a removal-only save too. It was gated on the
                    // selection count alone, so un-ticking the clinic's only
                    // doctor left the button greyed out — the rep was told
                    // "removido" and then given no way to commit it.
                    onPressed:
                        (_selectionCount == 0 && _pendingRemovals.isEmpty) ||
                            _saving
                        ? null
                        : _confirm,
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
                        : Text(_confirmLabel),
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
            case '_section_header_cnes_unknown':
              return _buildSectionHeader('Ainda não cadastrados');
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
        if (item is CnesSuggestion) {
          return item.isKnown
              ? _buildPersonTile(item.toRoster())
              : _buildUnknownTile(item);
        }

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
        // Un-ticking is staged, not done: the removal happens on save, and the
        // footer button says so ("Remover (1)"). There used to be a four-second
        // "removido" snackbar with an Undo here, which was wrong twice over —
        // it announced something that had not happened, and it did not go away
        // on its own, so it sat over the sheet through everything that
        // followed. Re-ticking the row is the undo, and it is where the rep is
        // already looking.
        onChanged: _saving
            ? null
            : (v) {
                setState(() {
                  if (v == true) {
                    _selected.add(d.id);
                  } else {
                    _selected.remove(d.id);
                  }
                });
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
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              [
                if (d.specialty != null) d.specialty!,
                if (d.crm != null) d.crm!,
              ].join(' · '),
              style: const TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
            /*
             * Roles, once the row is ticked and only for someone not already
             * linked here.
             *
             * Associating is the moment the rep knows what this person is to
             * the clinic; sending them back through the roster afterwards is
             * how roles stay unset. Optional, because not every person at a
             * clinic has one.
             */
            if (selected && !isAssociated && _roles.isNotEmpty) ...[
              const SizedBox(height: 6),
              _RoleChips(
                roles: _roles,
                selected: _selectedRoles[d.id] ?? const {},
                enabled: !_saving,
                onToggle: (roleId) => setState(() {
                  final chosen = _selectedRoles.putIfAbsent(
                    d.id,
                    () => <int>{},
                  );
                  if (!chosen.remove(roleId)) chosen.add(roleId);
                }),
              ),
            ],
          ],
        ),
        activeColor: AppColors.navyBright,
      );
    }
  }

  /// A person CNES places here that we do not hold.
  ///
  /// Same tile as everywhere else, plus a chip: the rep needs to know that
  /// ticking this one creates a professional record rather than linking one.
  /// Keyed by SUS id rather than person id, because there is no person yet.
  Widget _buildUnknownTile(CnesSuggestion s) {
    final roster = ProfessionalRoster(
      id: 0,
      name: s.displayName,
      initials: initialsFromName(s.displayName),
      hue: hueFromName(s.displayName),
      specialty: s.occupation,
      crm: s.registrationLabel,
    );
    final selected = _selectedCnesIds.contains(s.professionalCnesId);

    return CheckboxListTile(
      value: selected,
      onChanged: _saving
          ? null
          : (v) => setState(() {
              if (v == true) {
                _selectedCnesIds.add(s.professionalCnesId);
              } else {
                _selectedCnesIds.remove(s.professionalCnesId);
              }
            }),
      controlAffinity: ListTileControlAffinity.trailing,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
      secondary: CircleAvatar(
        backgroundColor: HSLColor.fromAHSL(1, roster.hue, 0.48, 0.88).toColor(),
        child: Text(
          roster.initials,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: HSLColor.fromAHSL(1, roster.hue, 0.55, 0.32).toColor(),
          ),
        ),
      ),
      title: Row(
        children: [
          Flexible(
            child: Text(
              roster.name,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
          ),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.gray100,
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text(
              'novo',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.gray500,
              ),
            ),
          ),
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            [
              if (roster.specialty != null) roster.specialty!,
              if (roster.crm != null) roster.crm!,
            ].join(' · '),
            style: const TextStyle(fontSize: 12, color: AppColors.gray500),
          ),
        ],
      ),
      activeColor: AppColors.navyBright,
    );
  }

  Future<void> _confirm() async {
    // Candidates come from the pool AND the CNES section. A suggestion is
    // deliberately absent from the pool — the server excludes people already
    // linked here, and the search knows nothing about the registry. Selecting
    // from `_pool` alone silently dropped every suggestion on save: the
    // checkbox ticked, the sheet closed, and nothing was associated.
    final candidates = <int, ProfessionalRoster>{
      for (final suggestion in _cnesRows)
        suggestion.personId!: suggestion.toRoster(),
      // Pool entries win on conflict: they carry the richer roster data.
      for (final doctor in _pool) doctor.id: doctor,
    };
    final chosen = candidates.values
        .where((d) => _selected.contains(d.id))
        .toList(growable: false);
    final toImport = _cnesUnknownRows
        .where((s) => _selectedCnesIds.contains(s.professionalCnesId))
        .toList(growable: false);
    final toRemove = _pendingRemovals;
    // Removals count as work. The guard read `chosen.isEmpty && toImport.isEmpty`
    // and returned, so un-ticking a doctor and pressing save did nothing at all.
    if ((chosen.isEmpty && toImport.isEmpty && toRemove.isEmpty) || !_useApi) {
      return;
    }
    // Everyone the server already counts as linked here, from either source.
    // `alreadyAssociatedIds` alone is the caller's view and can be narrower, and
    // posting an association for someone already associated is a write nobody
    // asked for.
    final alreadyLinked = <int>{
      ...widget.alreadyAssociatedIds,
      ..._cnesLinkedIds,
    };

    setState(() => _saving = true);
    final repo = _repository();
    try {
      // Only call associate for doctors not already linked — already-
      // associated ones are pre-checked and don't need an API call.
      final newlySelected = chosen
          .where((d) => !alreadyLinked.contains(d.id))
          .toList();
      /*
       * Which of them CNES placed here, so the association can carry the CBO.
       *
       * A doctor picked from the search pool is a bare "they work here"; the
       * same doctor picked from the CNES tab comes with what the export says
       * they do at this clinic, and routing both through the generic endpoint
       * threw the second half away — the roster gained a clinician with no
       * occupation while an imported one gained both.
       */
      final cnesByPersonId = <int, CnesSuggestion>{
        for (final suggestion in _cnesRows) suggestion.personId!: suggestion,
      };
      /*
       * Removals first, and each one before any association.
       *
       * A rep who un-ticks A and ticks B is trading one doctor for another; if
       * the association half runs first and the removal half then fails, the
       * clinic is left holding both. Ending affiliations first means a failure
       * leaves it holding neither the removal nor the addition — which is the
       * state they can see and retry from.
       */
      for (final doctor in toRemove) {
        await repo.endDoctorAffiliation(doctor);
      }

      final associated = <ProfessionalRoster>[];
      for (final doctor in newlySelected) {
        final roleIds = _rolesFor(doctor.id);
        final suggestion = cnesByPersonId[doctor.id];
        if (suggestion != null) {
          await repo.associateCnesProfessional(
            professionalCnesId: suggestion.professionalCnesId,
            occupationIds: _occupationsFor(suggestion),
            roleIds: roleIds,
          );
        } else {
          /*
           * Two calls, because the generic endpoint creates the affiliation and
           * roles hang off it. Ordered so a failure between them leaves a real
           * association missing only its role — recoverable from the roster,
           * unlike an association that never happened.
           */
          final personFacilityId = await repo.associateDoctor(doctor.id);
          if (roleIds.isNotEmpty && personFacilityId != null) {
            await repo.assignRoles(
              personFacilityId: personFacilityId,
              roleIds: roleIds,
            );
          }
        }
        associated.add(doctor);
      }

      /*
       * Importing leaves the sheet.
       *
       * Ticking a name here is a request to create a person, and a person
       * created from the four fields CNES ships is one somebody has to finish
       * later — specialty and role are missing, and every commercial view needs
       * them. The wizard collects the profile and performs the import itself,
       * one doctor at a time, so a rep who quits halfway keeps the ones already
       * confirmed.
       */
      var reused = 0;
      if (toImport.isNotEmpty) {
        if (!mounted) return;
        final outcome = await Navigator.of(context).push<CnesImportOutcome>(
          MaterialPageRoute(
            builder: (_) => CnesImportWizard(
              facilityId: widget.facilityId!,
              suggestions: toImport,
              repositoryBuilder: widget.repositoryBuilder ?? _defaultRepository,
              catalogues: widget.importCatalogues,
            ),
          ),
        );
        if (outcome != null) {
          reused = outcome.reused;
          associated.addAll(outcome.imported);
        }
      }

      if (!mounted) return;
      if (reused > 0) {
        /*
         * Told afterwards, not asked beforehand. The server refuses to create a
         * second record for a registration somebody already holds, so this is
         * never a duplicate — but the rep tapped a CNES name and got one of our
         * records, and silently swapping it would misreport what happened.
         */
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              reused == 1
                  ? '1 profissional já era cadastrado e foi associado'
                  : '$reused profissionais já eram cadastrados e foram associados',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      Navigator.of(context).pop(associated);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      // Ahead of anything queued. Un-ticking shows a four-second "removido"
      // confirmation, and a failure arriving behind it waits its turn — so the
      // rep reads "removido" while the removal is the thing that just failed.
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is FacilityAssociateException
                ? (e.message ?? 'Falha ao salvar')
                // Covers both halves: this save can now end affiliations as
                // well as create them, and "Falha ao associar" names the wrong
                // one when it was a removal that failed.
                : 'Falha ao salvar alterações',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      repo.dispose();
    }
  }
}

/// What this person is to the clinic, as togglable chips.
///
/// Nothing starts selected, unlike the occupation chips the wizard shows: CNES
/// states an occupation, and nobody states a role — it is the rep's own answer,
/// and an answer they are allowed not to have.
class _RoleChips extends StatelessWidget {
  const _RoleChips({
    required this.roles,
    required this.selected,
    required this.enabled,
    required this.onToggle,
  });

  final List<PersonFacilityRoleCatalogEntry> roles;
  final Set<int> selected;
  final bool enabled;
  final void Function(int roleId) onToggle;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final role in roles)
          GestureDetector(
            onTap: enabled ? () => onToggle(role.id) : null,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: selected.contains(role.id)
                    ? AppColors.navyBright
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: selected.contains(role.id)
                      ? AppColors.navyBright
                      : AppColors.gray300,
                ),
              ),
              child: Text(
                role.name,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: selected.contains(role.id)
                      ? Colors.white
                      : AppColors.gray500,
                ),
              ),
            ),
          ),
      ],
    );
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
