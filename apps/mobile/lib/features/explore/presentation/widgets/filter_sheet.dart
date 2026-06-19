import 'package:flutter/material.dart';
import '../../data/explore_list_filters.dart';
import '../../data/explore_repository.dart';
import '../../data/mappers/explore_mapper.dart';
import 'searchable_filter_dropdown.dart';

class FilterSheet extends StatefulWidget {
  final bool open;
  final VoidCallback onClose;
  final String kind;
  final Map<String, List<String>> filters;
  final ExploreFilterOptions filterOptions;
  final ExploreRepository repository;
  final ValueChanged<Map<String, List<String>>> onApply;

  const FilterSheet({
    super.key,
    required this.open,
    required this.onClose,
    required this.kind,
    required this.filters,
    required this.repository,
    this.filterOptions = const ExploreFilterOptions(),
    required this.onApply,
  });

  @override
  State<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<FilterSheet>
    with SingleTickerProviderStateMixin {
  late Map<String, List<String>> _local;
  late AnimationController _animController;
  late Animation<double> _overlayAnim;
  late Animation<double> _sheetAnim;

  @override
  void initState() {
    super.initState();
    _local = _copyFilters(widget.filters);
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );
    _overlayAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animController, curve: Curves.ease),
    );
    _sheetAnim = Tween<double>(begin: 1, end: 0).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Cubic(0.2, 0.8, 0.2, 1),
      ),
    );
    if (widget.open) _animController.forward();
  }

  @override
  void didUpdateWidget(FilterSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.open && !oldWidget.open) {
      _local = _copyFilters(widget.filters);
      _animController.forward();
    } else if (!widget.open && oldWidget.open) {
      _animController.reverse();
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Map<String, List<String>> _copyFilters(Map<String, List<String>> source) {
    return source.map((key, value) => MapEntry(key, List<String>.from(value)));
  }

  void _setList(String key, List<String> values) {
    setState(() {
      final next = _copyFilters(_local);
      if (values.isEmpty) {
        next.remove(key);
      } else {
        next[key] = values;
      }
      _local = next;
    });
  }

  int get _count =>
      (_local['status']?.length ?? 0) +
      (_local['products']?.length ?? 0) +
      (_local['state']?.length ?? 0) +
      (_local['city']?.length ?? 0) +
      (_local['facilityType']?.length ?? 0) +
      (_local['specialties']?.length ?? 0);

  @override
  Widget build(BuildContext context) {
    if (!widget.open && _animController.isDismissed) {
      return const SizedBox.shrink();
    }

    final sheetHeight = MediaQuery.sizeOf(context).height * 0.82;

    return Stack(
      children: [
        FadeTransition(
          opacity: _overlayAnim,
          child: GestureDetector(
            onTap: widget.onClose,
            child: Container(color: Colors.black.withValues(alpha: 0.45)),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: AnimatedBuilder(
            animation: _animController,
            builder: (context, child) {
              return Transform.translate(
                offset: Offset(0, _sheetAnim.value * sheetHeight),
                child: child,
              );
            },
            child: Container(
              height: sheetHeight,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: Color(0x33000000),
                    blurRadius: 40,
                    offset: Offset(0, -12),
                  ),
                ],
              ),
              child: Column(
                children: [
                  const SizedBox(height: 12),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFd1d5db),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Filtros',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0f1729),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      physics: const BouncingScrollPhysics(),
                      child: widget.kind == 'clinic'
                          ? _ClinicFilters(
                              local: _local,
                              filterOptions: widget.filterOptions,
                              repository: widget.repository,
                              onSetList: _setList,
                            )
                          : _DoctorFilters(
                              local: _local,
                              onSetList: _setList,
                            ),
                    ),
                  ),
                  _buildButtons(),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildButtons() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.withValues(alpha: 0.15))),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() => _local = {}),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(46),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Limpar'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: () => widget.onApply(_local),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(46),
                  backgroundColor: const Color(0xFF1e40af),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text('Aplicar${_count > 0 ? ' ($_count)' : ''}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClinicFilters extends StatelessWidget {
  final Map<String, List<String>> local;
  final ExploreFilterOptions filterOptions;
  final ExploreRepository repository;
  final void Function(String key, List<String> values) onSetList;

  const _ClinicFilters({
    required this.local,
    required this.filterOptions,
    required this.repository,
    required this.onSetList,
  });

  static const _statuses = [
    ('ativa', 'Ativa', Color(0xFF16a373)),
    ('negociacao', 'Em negociação', Color(0xFFc6861b)),
    ('inativa', 'Inativa', Color(0xFF6b7280)),
    ('nunca', 'Nunca comprou', Color(0xFF3b82f6)),
    ('rejeicao', 'Rejeição', Color(0xFFb84545)),
  ];

  static const _products = [
    'AtlasGel', 'AtlasCaps', 'AtlasSpray', 'AtlasDerm',
  ];

  @override
  Widget build(BuildContext context) {
    final stateOptions = filterOptions.states
        .map(
          (state) => SearchableFilterOption(
            value: state.code,
            label: '${state.code} — ${state.name}',
            subtitle: state.name,
          ),
        )
        .toList();

    final typeOptions = filterOptions.facilityTypes
        .map(
          (type) => SearchableFilterOption(
            value: type,
            label: formatDisplayName(type),
          ),
        )
        .toList();

    final selectedStates = local['state'] ?? const [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SearchableFilterDropdown(
          label: 'Estado (UF)',
          hint: 'Selecionar UF',
          selectedValues: selectedStates,
          options: stateOptions,
          searchHint: 'Buscar UF ou estado…',
          onChanged: (values) {
            onSetList('state', values);
            if (values.isEmpty) return;
            final cities = local['city'] ?? const [];
            if (cities.isEmpty) return;
            onSetList('city', const []);
          },
        ),
        SearchableFilterDropdown(
          label: 'Cidade',
          hint: 'Selecionar cidade',
          selectedValues: local['city'] ?? const [],
          options: const [],
          searchHint: 'Buscar cidade…',
          onSearch: (query) async {
            final cities = await repository.searchCities(
              search: query,
              stateCodes: selectedStates,
            );
            return cities
                .map(
                  (city) => SearchableFilterOption(
                    value: city.name,
                    label: formatDisplayName(city.name),
                    subtitle: city.stateCode,
                  ),
                )
                .toList();
          },
          onChanged: (values) => onSetList('city', values),
        ),
        SearchableFilterDropdown(
          label: 'Tipo de estabelecimento',
          hint: 'Selecionar tipo',
          selectedValues: local['facilityType'] ?? const [],
          options: typeOptions,
          searchHint: 'Buscar tipo…',
          onChanged: (values) => onSetList('facilityType', values),
        ),
        _SectionHeader(title: 'Status'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _statuses.map((s) {
              final on = (local['status'] ?? []).contains(s.$1);
              return _ToggleChip(
                label: s.$2,
                dotColor: s.$3,
                selected: on,
                onTap: () {
                  final current = List<String>.from(local['status'] ?? []);
                  if (current.contains(s.$1)) {
                    current.remove(s.$1);
                  } else {
                    current.add(s.$1);
                  }
                  onSetList('status', current);
                },
              );
            }).toList(),
          ),
        ),
        _SectionHeader(title: 'Produto em uso'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _products.map((p) {
              final on = (local['products'] ?? []).contains(p);
              return _SimpleChip(
                label: p,
                selected: on,
                onTap: () {
                  final current = List<String>.from(local['products'] ?? []);
                  if (current.contains(p)) {
                    current.remove(p);
                  } else {
                    current.add(p);
                  }
                  onSetList('products', current);
                },
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}

class _DoctorFilters extends StatelessWidget {
  final Map<String, List<String>> local;
  final void Function(String key, List<String> values) onSetList;

  const _DoctorFilters({
    required this.local,
    required this.onSetList,
  });

  static const _specialties = [
    'Cardiologia', 'Ortopedia', 'Dermatologia', 'Pediatria',
    'Ginecologia', 'Neurologia', 'Endocrinologia',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'Especialidade'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _specialties.map((s) {
              final on = (local['specialties'] ?? []).contains(s);
              return _SimpleChip(
                label: s,
                selected: on,
                onTap: () {
                  final current = List<String>.from(local['specialties'] ?? []);
                  if (current.contains(s)) {
                    current.remove(s);
                  } else {
                    current.add(s);
                  }
                  onSetList('specialties', current);
                },
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 4),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1,
          color: Color(0xFF6b7280),
        ),
      ),
    );
  }
}

class _ToggleChip extends StatelessWidget {
  final String label;
  final Color dotColor;
  final bool selected;
  final VoidCallback onTap;

  const _ToggleChip({
    required this.label,
    required this.dotColor,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? dotColor.withValues(alpha: 0.1) : const Color(0xFFf3f4f6),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? dotColor : Colors.transparent,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? dotColor : const Color(0xFF374151),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SimpleChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _SimpleChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF1e40af) : const Color(0xFFf3f4f6),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? const Color(0xFF1e40af) : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : const Color(0xFF374151),
          ),
        ),
      ),
    );
  }
}
