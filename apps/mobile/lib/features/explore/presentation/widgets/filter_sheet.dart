import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/api_repository_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/bottom_sheet.dart';

class FilterSheet extends ConsumerStatefulWidget {
  final String kind;
  final Map<String, List<String>> filters;
  final double? radiusKm;
  final void Function(Map<String, List<String>> filters, double? radiusKm)
  onApply;

  const FilterSheet({
    super.key,
    required this.kind,
    required this.filters,
    required this.radiusKm,
    required this.onApply,
  });

  @override
  ConsumerState<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<FilterSheet> {
  late Map<String, List<String>> _local;
  double? _radiusKm;

  @override
  void initState() {
    super.initState();
    _local = {
      for (final e in widget.filters.entries) e.key: List<String>.from(e.value),
    };
    // Produtos filter removed from Explorar v1 UI.
    _local.remove('products');
    _radiusKm = widget.radiusKm;
  }

  void _toggleMulti(String key, String value) {
    setState(() {
      final list = List<String>.from(_local[key] ?? []);
      if (list.contains(value)) {
        list.remove(value);
      } else {
        list.add(value);
      }
      _local[key] = list;
    });
  }

  void _selectSingle(String key, String value) {
    setState(() {
      final current = _local[key] ?? const <String>[];
      if (current.length == 1 && current.first == value) {
        _local[key] = [];
      } else {
        _local[key] = [value];
      }
    });
  }

  int get _count {
    var n =
        (_local['status']?.length ?? 0) + (_local['specialties']?.length ?? 0);
    if (widget.kind == 'clinic' && _radiusKm != null) n += 1;
    return n;
  }

  @override
  Widget build(BuildContext context) {
    return BottomSheetWidget(
      title: 'Filtros',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.kind == 'clinic') ...[
            _ClinicFilters(
              local: _local,
              radiusKm: _radiusKm,
              onSelectStatus: (v) => _selectSingle('status', v),
              onSelectRadius: (km) {
                setState(() {
                  _radiusKm = _radiusKm == km ? null : km;
                });
              },
            ),
          ] else
            _DoctorFilters(
              local: _local,
              specialtiesAsync: ref.watch(professionalSpecialtiesProvider),
              onToggle: (v) => _toggleMulti('specialties', v),
              onRetry: () => ref.invalidate(professionalSpecialtiesProvider),
            ),
          _buildButtons(),
        ],
      ),
    );
  }

  Widget _buildButtons() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() {
                _local = {};
                _radiusKm = null;
              }),
              child: Container(
                height: 46,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFe5e7eb)),
                  color: Colors.white,
                ),
                child: const Center(
                  child: Text(
                    'Limpar',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF374151),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: GestureDetector(
              onTap: () {
                final next = Map<String, List<String>>.from(_local)
                  ..remove('products');
                widget.onApply(next, _radiusKm);
              },
              child: Container(
                height: 46,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: const Color(0xFF1e40af),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x4D1e40af),
                      blurRadius: 12,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    'Aplicar${_count > 0 ? ' ($_count)' : ''}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ClinicFilters extends StatelessWidget {
  final Map<String, List<String>> local;
  final double? radiusKm;
  final ValueChanged<String> onSelectStatus;
  final ValueChanged<double> onSelectRadius;

  const _ClinicFilters({
    required this.local,
    required this.radiusKm,
    required this.onSelectStatus,
    required this.onSelectRadius,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeader(title: 'Status'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: CommercialStatusFilter.values.map((value) {
              final on = (local['status'] ?? []).contains(value);
              final color = CommercialStatusFilter.color(value);
              return _ToggleChip(
                label: CommercialStatusFilter.label(value),
                dotColor: color,
                selected: on,
                onTap: () => onSelectStatus(value),
              );
            }).toList(),
          ),
        ),
        const _SectionHeader(title: 'Distância'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: exploreRadiusKmOptions.map((km) {
              final selected = radiusKm == km;
              return _SimpleChip(
                label: '${km.toInt()} km',
                selected: selected,
                onTap: () => onSelectRadius(km),
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
  final AsyncValue<List<String>> specialtiesAsync;
  final ValueChanged<String> onToggle;
  final VoidCallback onRetry;

  const _DoctorFilters({
    required this.local,
    required this.specialtiesAsync,
    required this.onToggle,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final selected = local['specialties'] ?? const <String>[];

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeader(title: 'Especialidade'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: specialtiesAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Carregando especialidades…',
                style: TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
              ),
            ),
            error: (_, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Não foi possível carregar as especialidades.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
                ),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: onRetry,
                  child: const Text(
                    'Tentar novamente',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF2563eb),
                    ),
                  ),
                ),
              ],
            ),
            data: (specialties) {
              final options = <String>{...specialties, ...selected}.toList()
                ..sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));

              if (options.isEmpty) {
                return const Text(
                  'Nenhuma especialidade disponível no seu escopo.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
                );
              }

              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: options.map((s) {
                  final on = selected.contains(s);
                  return _SimpleChip(
                    label: s,
                    selected: on,
                    onTap: () => onToggle(s),
                  );
                }).toList(),
              );
            },
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
          color: selected
              ? dotColor.withValues(alpha: 0.1)
              : const Color(0xFFf3f4f6),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? dotColor : Colors.transparent),
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
