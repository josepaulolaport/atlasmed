import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/bottom_sheet.dart';

class FilterSheet extends StatefulWidget {
  final String kind;
  final Map<String, List<String>> filters;
  final bool proximityEnabled;
  final bool requestingProximity;
  final VoidCallback onProximityToggle;
  final ValueChanged<Map<String, List<String>>> onApply;

  const FilterSheet({
    super.key,
    required this.kind,
    required this.filters,
    required this.proximityEnabled,
    required this.requestingProximity,
    required this.onProximityToggle,
    required this.onApply,
  });

  @override
  State<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<FilterSheet> {
  late Map<String, List<String>> _local;

  @override
  void initState() {
    super.initState();
    _local = Map.from(widget.filters);
  }

  void _toggle(String key, String value) {
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

  int get _count =>
      (_local['status']?.length ?? 0) +
      (_local['products']?.length ?? 0) +
      (_local['specialties']?.length ?? 0);

  @override
  Widget build(BuildContext context) {
    return BottomSheetWidget(
      title: 'Filtros',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ProximityFilter(
            enabled: widget.proximityEnabled,
            isLoading: widget.requestingProximity,
            onChanged: widget.onProximityToggle,
          ),
          widget.kind == 'clinic'
              ? _ClinicFilters(local: _local, onToggle: _toggle)
              : _DoctorFilters(local: _local, onToggle: _toggle),
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
              onTap: () => setState(() => _local = {}),
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
              onTap: () => widget.onApply(_local),
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

class _ProximityFilter extends StatelessWidget {
  final bool enabled;
  final bool isLoading;
  final VoidCallback onChanged;

  const _ProximityFilter({
    required this.enabled,
    required this.isLoading,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 16, 12),
      child: Row(
        children: [
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Usar minha localização',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0f1729),
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Preparar filtro por proximidade',
                  style: TextStyle(fontSize: 12, color: Color(0xFF6b7280)),
                ),
              ],
            ),
          ),
          if (isLoading)
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Switch(value: enabled, onChanged: (_) => onChanged()),
        ],
      ),
    );
  }
}

class _ClinicFilters extends StatelessWidget {
  final Map<String, List<String>> local;
  final void Function(String key, String value) onToggle;

  const _ClinicFilters({required this.local, required this.onToggle});

  static const _statuses = [
    ('ativa', 'Ativa', Color(0xFF16a373)),
    ('negociacao', 'Em negociação', Color(0xFFc6861b)),
    ('inativa', 'Inativa', Color(0xFF6b7280)),
    ('nunca', 'Nunca comprou', Color(0xFF3b82f6)),
    ('rejeicao', 'Rejeição', Color(0xFFb84545)),
  ];

  static const _products = ['AtlasGel', 'AtlasCaps', 'AtlasSpray', 'AtlasDerm'];

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
                onTap: () => onToggle('status', s.$1),
              );
            }).toList(),
          ),
        ),
        _SectionHeader(title: 'Produto em uso'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _products.map((p) {
              final on = (local['products'] ?? []).contains(p);
              return _SimpleChip(
                label: p,
                selected: on,
                onTap: () => onToggle('products', p),
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
  final void Function(String key, String value) onToggle;

  const _DoctorFilters({required this.local, required this.onToggle});

  static const _specialties = [
    'Cardiologia',
    'Ortopedia',
    'Dermatologia',
    'Pediatria',
    'Ginecologia',
    'Neurologia',
    'Endocrinologia',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'Especialidade'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _specialties.map((s) {
              final on = (local['specialties'] ?? []).contains(s);
              return _SimpleChip(
                label: s,
                selected: on,
                onTap: () => onToggle('specialties', s),
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
