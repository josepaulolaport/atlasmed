import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';

import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_specialties_repository.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/providers/specialties_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/bottom_sheet.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

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
  late final TextEditingController _minimumIntervalController;
  late final TextEditingController _maximumIntervalController;
  double? _radiusKm;

  @override
  void initState() {
    super.initState();
    _local = {
      for (final e in widget.filters.entries) e.key: List<String>.from(e.value),
    };
    // Produtos filter removed from Explorar v1 UI.
    _local.remove('products');
    _minimumIntervalController = TextEditingController(
      text: _local['purchaseIntervalMinDays']?.first ?? '',
    );
    _maximumIntervalController = TextEditingController(
      text: _local['purchaseIntervalMaxDays']?.first ?? '',
    );
    _radiusKm = widget.radiusKm;
  }

  @override
  void dispose() {
    _minimumIntervalController.dispose();
    _maximumIntervalController.dispose();
    super.dispose();
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
        (_local['status']?.length ?? 0) +
        (_local['specialties']?.length ?? 0) +
        (_local['purchaseFunnelStage']?.length ?? 0) +
        (_local['purchaseProfile']?.length ?? 0) +
        (_minimumIntervalController.text.isEmpty ? 0 : 1) +
        (_maximumIntervalController.text.isEmpty ? 0 : 1);
    if (widget.kind == 'clinic' && _radiusKm != null) n += 1;
    return n;
  }

  @override
  Widget build(BuildContext context) {
    return BottomSheetWidget(
      title: 'Filtros',
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.75,
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (widget.kind == 'clinic')
                      _ClinicFilters(
                        local: _local,
                        radiusKm: _radiusKm,
                        onSelectStatus: (v) => _selectSingle('status', v),
                        onToggleFunnelStage: (v) =>
                            _toggleMulti('purchaseFunnelStage', v),
                        onSelectProfile: (v) =>
                            _selectSingle('purchaseProfile', v),
                        minimumIntervalController: _minimumIntervalController,
                        maximumIntervalController: _maximumIntervalController,
                        onIntervalChanged: () => setState(() {}),
                        onSelectRadius: (km) {
                          setState(() {
                            _radiusKm = _radiusKm == km ? null : km;
                          });
                        },
                      )
                    else
                      _DoctorFilters(
                        local: _local,
                        onToggle: (v) => _toggleMulti('specialties', v),
                      ),
                  ],
                ),
              ),
            ),
            _buildButtons(),
          ],
        ),
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
                _minimumIntervalController.clear();
                _maximumIntervalController.clear();
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
                      color: AppColors.gray700,
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
                final minimum = int.tryParse(_minimumIntervalController.text);
                final maximum = int.tryParse(_maximumIntervalController.text);
                if ((minimum != null && (minimum < 1 || minimum > 3650)) ||
                    (maximum != null && (maximum < 1 || maximum > 3650)) ||
                    (minimum != null && maximum != null && minimum > maximum)) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Informe intervalos entre 1 e 3650 dias, com mínimo menor ou igual ao máximo.',
                      ),
                    ),
                  );
                  return;
                }
                final next = Map<String, List<String>>.from(_local)
                  ..remove('products');
                if (minimum == null) {
                  next.remove('purchaseIntervalMinDays');
                } else {
                  next['purchaseIntervalMinDays'] = [minimum.toString()];
                }
                if (maximum == null) {
                  next.remove('purchaseIntervalMaxDays');
                } else {
                  next['purchaseIntervalMaxDays'] = [maximum.toString()];
                }
                widget.onApply(next, _radiusKm);
              },
              child: Container(
                height: 46,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: const AppColors.navyBright,
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
  final ValueChanged<String> onToggleFunnelStage;
  final ValueChanged<String> onSelectProfile;
  final TextEditingController minimumIntervalController;
  final TextEditingController maximumIntervalController;
  final VoidCallback onIntervalChanged;
  final ValueChanged<double> onSelectRadius;

  const _ClinicFilters({
    required this.local,
    required this.radiusKm,
    required this.onSelectStatus,
    required this.onToggleFunnelStage,
    required this.onSelectProfile,
    required this.minimumIntervalController,
    required this.maximumIntervalController,
    required this.onIntervalChanged,
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
        const _SectionHeader(title: 'Recorrência de compras'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: PurchaseFunnelStage.values.map((stage) {
              final selected = (local['purchaseFunnelStage'] ?? []).contains(
                stage.apiValue,
              );
              return _SimpleChip(
                label: stage.label,
                selected: selected,
                onTap: () => onToggleFunnelStage(stage.apiValue),
              );
            }).toList(),
          ),
        ),
        const _SectionHeader(title: 'Perfil de compra'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: PurchaseProfile.values.map((profile) {
              final selected = (local['purchaseProfile'] ?? []).contains(
                profile.apiValue,
              );
              return _SimpleChip(
                label: profile.label,
                selected: selected,
                onTap: () => onSelectProfile(profile.apiValue),
              );
            }).toList(),
          ),
        ),
        const _SectionHeader(title: 'Intervalo de compra (dias)'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: minimumIntervalController,
                  onChanged: (_) => onIntervalChanged(),
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(labelText: 'Mínimo'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: maximumIntervalController,
                  onChanged: (_) => onIntervalChanged(),
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(labelText: 'Máximo'),
                ),
              ),
            ],
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

class _DoctorFilters extends ConsumerWidget {
  final Map<String, List<String>> local;
  final ValueChanged<String> onToggle;

  const _DoctorFilters({required this.local, required this.onToggle});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
                style: TextStyle(fontSize: 13, color: AppColors.gray500),
              ),
            ),
            error: (_, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Não foi possível carregar as especialidades.',
                  style: TextStyle(fontSize: 13, color: AppColors.gray500),
                ),
                builder: (context, specialties, repository) {
                  final options =
                      <String>{...?specialties, ...selected}.toList()..sort(
                        (a, b) => a.toLowerCase().compareTo(b.toLowerCase()),
                      );

              if (options.isEmpty) {
                return const Text(
                  'Nenhuma especialidade disponível no seu escopo.',
                  style: TextStyle(fontSize: 13, color: AppColors.gray500),
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
          color: AppColors.gray500,
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
              : const AppColors.gray100,
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
                color: selected ? dotColor : const AppColors.gray700,
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
          color: selected ? const AppColors.navyBright : const AppColors.gray100,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? const AppColors.navyBright : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : const AppColors.gray700,
          ),
        ),
      ),
    );
  }
}
