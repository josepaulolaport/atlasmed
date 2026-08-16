import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/clinical_focus_labels.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinical_focuses_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_unit_types_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_specialties_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_unit_types_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinical_focuses_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/specialties_providers.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class SpecialtyOption {
  const SpecialtyOption({required this.value, required this.label});

  final String value;
  final String label;
}

/// Standalone picker — search + multi-select list.
///
/// Serves every long catalogue on the clinic filter sheet. `clinic` picks
/// clinical focus ids, `doctor` specialty names, `unit-type` CNES unit type
/// ids. They differ only in where the options come from and what the chrome is
/// called; the search, selection and apply behaviour is the same question every
/// time, so it is asked in one place.
class SpecialtyFilterDrawer extends ConsumerStatefulWidget {
  const SpecialtyFilterDrawer({
    super.key,
    required this.kind,
    required this.initialSelected,
  });

  /// `clinic` | `doctor` | `unit-type`
  final String kind;
  final Set<String> initialSelected;

  /// Returns selected values, or `null` if dismissed without apply.
  static Future<Set<String>?> show(
    BuildContext context, {
    required String kind,
    required Set<String> selected,
  }) {
    return showModalBottomSheet<Set<String>>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (_) =>
          SpecialtyFilterDrawer(kind: kind, initialSelected: selected),
    );
  }

  /// Heading, and the noun the search field and empty states use.
  static ({String title, String hint, String empty, String notFound}) copyFor(
    String kind,
  ) => switch (kind) {
    'unit-type' => (
      title: 'Tipo de unidade',
      hint: 'Buscar tipo de unidade…',
      empty: 'Nenhum tipo de unidade disponível no seu escopo.',
      notFound: 'Nenhum tipo de unidade encontrado.',
    ),
    // A clinic's is a *foco clínico*, which is what every row and every chip
    // in the app calls it ("Sem foco clínico"). Only the filter called it a
    // specialty, so the same field had two names one screen apart — and beside
    // the doctors filter, which lists actual medical specialties, it read as
    // though they were the same list.
    'clinic' => (
      title: 'Foco clínico',
      hint: 'Buscar foco clínico…',
      empty: 'Nenhum foco clínico disponível no seu escopo.',
      notFound: 'Nenhum foco clínico encontrado.',
    ),
    _ => (
      title: 'Especialidade',
      hint: 'Buscar especialidade…',
      empty: 'Nenhuma especialidade disponível no seu escopo.',
      notFound: 'Nenhuma especialidade encontrada.',
    ),
  };

  @override
  ConsumerState<SpecialtyFilterDrawer> createState() =>
      _SpecialtyFilterDrawerState();
}

class _SpecialtyFilterDrawerState extends ConsumerState<SpecialtyFilterDrawer> {
  late Set<String> _selected;
  final _queryController = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _selected = Set<String>.from(widget.initialSelected);
  }

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  void _toggle(String value) {
    setState(() {
      if (_selected.contains(value)) {
        _selected.remove(value);
      } else {
        _selected.add(value);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final copy = SpecialtyFilterDrawer.copyFor(widget.kind);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: DraggableScrollableSheet(
        initialChildSize: 0.78,
        minChildSize: 0.45,
        maxChildSize: 0.94,
        expand: false,
        builder: (context, scrollController) {
          // Material (not DecoratedBox) so ListTile ink/splash paints correctly.
          return Material(
            color: Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 10),
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.gray300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 12, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          copy.title,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: AppColors.gray900,
                            letterSpacing: -0.2,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: _selected.isEmpty
                            ? null
                            : () => setState(_selected.clear),
                        child: const Text('Limpar'),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: _SearchField(
                    controller: _queryController,
                    hintText: copy.hint,
                    onChanged: (value) => setState(() => _query = value),
                  ),
                ),
                if (_selected.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        '${_selected.length} selecionada${_selected.length == 1 ? '' : 's'}',
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.gray500,
                        ),
                      ),
                    ),
                  ),
                Expanded(
                  child: widget.kind == 'unit-type'
                      ? _UnitTypeList(
                          scrollController: scrollController,
                          query: _query,
                          selected: _selected,
                          onToggle: _toggle,
                        )
                      : widget.kind == 'clinic'
                      ? _ClinicSpecialtyList(
                          scrollController: scrollController,
                          query: _query,
                          selected: _selected,
                          onToggle: _toggle,
                        )
                      : _DoctorSpecialtyList(
                          scrollController: scrollController,
                          query: _query,
                          selected: _selected,
                          onToggle: _toggle,
                        ),
                ),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
                    child: SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.navyBright,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: () =>
                            Navigator.pop(context, Set<String>.from(_selected)),
                        child: Text(
                          _selected.isEmpty
                              ? 'Aplicar'
                              : 'Aplicar (${_selected.length})',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.hintText,
    required this.onChanged,
  });

  final TextEditingController controller;
  final String hintText;
  final ValueChanged<String> onChanged;

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
              controller: controller,
              onChanged: onChanged,
              decoration: InputDecoration(
                hintText: hintText,
                hintStyle: const TextStyle(color: AppColors.gray400),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
              style: const TextStyle(fontSize: 14, color: AppColors.gray900),
            ),
          ),
          if (controller.text.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.close_rounded, size: 18),
              color: AppColors.gray500,
              onPressed: () {
                controller.clear();
                onChanged('');
              },
            ),
        ],
      ),
    );
  }
}

class _ClinicSpecialtyList extends ConsumerWidget {
  const _ClinicSpecialtyList({
    required this.scrollController,
    required this.query,
    required this.selected,
    required this.onToggle,
  });

  final ScrollController scrollController;
  final String query;
  final Set<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(clinicalFocusesRepositoryProvider);
    return RepositoryBuilder<
      ClinicalFocusesRepository,
      List<ClinicalFocusOption>
    >(
      repository: repo,
      builder: (context, snapshot, _) {
        if (snapshot == null) {
          return const Center(
            child: Text(
              'Carregando especialidades…',
              style: TextStyle(fontSize: 13, color: AppColors.gray500),
            ),
          );
        }

        final byId = {for (final o in snapshot) o.id.toString(): o};
        final ids = <String>{...byId.keys, ...selected}.toList();
        ids.sort((a, b) {
          final rank =
              ClinicalFocusLabels.priorityRank(byId[a]?.name ?? a) -
              ClinicalFocusLabels.priorityRank(byId[b]?.name ?? b);
          if (rank != 0) return rank;
          return (byId[a]?.label ?? a).compareTo(byId[b]?.label ?? b);
        });

        final options = [
          for (final id in ids)
            SpecialtyOption(value: id, label: byId[id]?.label ?? id),
        ];

        return _OptionsList(
          scrollController: scrollController,
          options: options,
          query: query,
          selected: selected,
          onToggle: onToggle,
        );
      },
    );
  }
}

class _DoctorSpecialtyList extends ConsumerWidget {
  const _DoctorSpecialtyList({
    required this.scrollController,
    required this.query,
    required this.selected,
    required this.onToggle,
  });

  final ScrollController scrollController;
  final String query;
  final Set<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(professionalSpecialtiesRepositoryProvider);
    return RepositoryBuilder<ProfessionalSpecialtiesRepository, List<String>>(
      repository: repo,
      builder: (context, snapshot, _) {
        if (snapshot == null) {
          return const Center(
            child: Text(
              'Carregando especialidades…',
              style: TextStyle(fontSize: 13, color: AppColors.gray500),
            ),
          );
        }

        final values = <String>{...snapshot, ...selected}.toList()
          ..sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
        final options = [
          for (final value in values)
            SpecialtyOption(
              value: value,
              label: ClinicalFocusLabels.formatName(value),
            ),
        ];

        return _OptionsList(
          scrollController: scrollController,
          options: options,
          query: query,
          selected: selected,
          onToggle: onToggle,
        );
      },
    );
  }
}

/// CNES unit types, from the same catalogue the chips used to render.
///
/// A drawer rather than chips because the names are long — "Unidade De Apoio
/// Diagnose E Terapia (sadt Isolado)" — and twelve of them wrap into a wall
/// that pushes the rest of the sheet off screen. Same reason Especialidade is
/// a drawer.
class _UnitTypeList extends ConsumerWidget {
  const _UnitTypeList({
    required this.scrollController,
    required this.query,
    required this.selected,
    required this.onToggle,
  });

  final ScrollController scrollController;
  final String query;
  final Set<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final copy = SpecialtyFilterDrawer.copyFor('unit-type');
    final repository = ref.watch(facilityUnitTypesRepositoryProvider);
    return RepositoryBuilder<
      FacilityUnitTypesRepository,
      List<FacilityUnitTypeOption>
    >(
      repository: repository,
      builder: (context, snapshot, _) {
        if (snapshot == null) {
          return const Center(
            child: Text(
              'Carregando tipos de unidade…',
              style: TextStyle(fontSize: 13, color: AppColors.gray500),
            ),
          );
        }

        final byId = {for (final o in snapshot) o.id.toString(): o};
        // Selected ids the catalogue no longer offers still render, so a rep
        // can see and clear a filter they already applied.
        final ids = <String>{...byId.keys, ...selected}.toList()
          ..sort(
            (a, b) => (byId[a]?.label ?? a).compareTo(byId[b]?.label ?? b),
          );

        return _OptionsList(
          scrollController: scrollController,
          options: [
            for (final id in ids)
              SpecialtyOption(value: id, label: byId[id]?.label ?? id),
          ],
          query: query,
          selected: selected,
          onToggle: onToggle,
          emptyLabel: copy.empty,
          notFoundLabel: copy.notFound,
        );
      },
    );
  }
}

class _OptionsList extends StatelessWidget {
  const _OptionsList({
    required this.scrollController,
    required this.options,
    required this.query,
    required this.selected,
    required this.onToggle,
    this.emptyLabel = 'Nenhuma especialidade disponível no seu escopo.',
    this.notFoundLabel = 'Nenhuma especialidade encontrada.',
  });

  final ScrollController scrollController;
  final List<SpecialtyOption> options;
  final String query;
  final Set<String> selected;
  final ValueChanged<String> onToggle;
  final String emptyLabel;
  final String notFoundLabel;

  @override
  Widget build(BuildContext context) {
    final q = query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? options
        : options
              .where((o) => o.label.toLowerCase().contains(q))
              .toList(growable: false);

    if (options.isEmpty) {
      return Center(
        child: Text(
          emptyLabel,
          style: const TextStyle(fontSize: 13, color: AppColors.gray500),
        ),
      );
    }

    if (filtered.isEmpty) {
      return Center(
        child: Text(
          notFoundLabel,
          style: const TextStyle(fontSize: 13, color: AppColors.gray500),
        ),
      );
    }

    return ListView.separated(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
      itemCount: filtered.length,
      separatorBuilder: (_, _) =>
          const Divider(height: 1, color: AppColors.gray100),
      itemBuilder: (context, index) {
        final option = filtered[index];
        final on = selected.contains(option.value);
        return ListTile(
          onTap: () => onToggle(option.value),
          title: Text(
            option.label,
            style: TextStyle(
              fontSize: 14.5,
              fontWeight: on ? FontWeight.w600 : FontWeight.w500,
              color: on ? AppColors.navyBright : AppColors.gray800,
            ),
          ),
          trailing: Icon(
            on ? Icons.check_circle_rounded : Icons.circle_outlined,
            size: 22,
            color: on ? AppColors.navyBright : AppColors.gray300,
          ),
        );
      },
    );
  }
}
