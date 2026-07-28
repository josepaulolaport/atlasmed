import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/bottom_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/specialty_filter_drawer.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class FilterSheet extends ConsumerStatefulWidget {
  final String kind;
  final Map<String, List<String>> filters;
  final double? radiusKm;
  final void Function(Map<String, List<String>> filters, double? radiusKm)
  onApply;

  /// Desempenho drill-down: hide commercial-status chips.
  final bool hideCommercialStatus;

  /// Desempenho drill-down: bucket already locks funnel stages.
  final bool hidePurchaseFunnel;

  const FilterSheet({
    super.key,
    required this.kind,
    required this.filters,
    required this.radiusKm,
    required this.onApply,
    this.hideCommercialStatus = false,
    this.hidePurchaseFunnel = false,
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

  Future<void> _openSpecialtyDrawer() async {
    final key = widget.kind == 'clinic' ? 'serviceCodes' : 'specialties';
    final result = await SpecialtyFilterDrawer.show(
      context,
      kind: widget.kind,
      selected: Set<String>.from(_local[key] ?? const []),
    );
    if (!mounted || result == null) return;
    setState(() {
      _local[key] = result.toList(growable: false);
    });
  }

  int get _count {
    var n =
        (widget.hideCommercialStatus ? 0 : (_local['status']?.length ?? 0)) +
        (_local['specialties']?.length ?? 0) +
        (_local['serviceCodes']?.length ?? 0) +
        (widget.hidePurchaseFunnel
            ? 0
            : (_local['purchaseBucket']?.length ?? 0)) +
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
                        hideCommercialStatus: widget.hideCommercialStatus,
                        hidePurchaseFunnel: widget.hidePurchaseFunnel,
                        onSelectStatus: (v) => _selectSingle('status', v),
                        onTogglePurchaseBucket: (v) =>
                            _toggleMulti('purchaseBucket', v),
                        onSelectProfile: (v) =>
                            _selectSingle('purchaseProfile', v),
                        onOpenSpecialty: _openSpecialtyDrawer,
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
                      Padding(
                        padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                        child: _SpecialtyNavRow(
                          count: _local['specialties']?.length ?? 0,
                          onTap: _openSpecialtyDrawer,
                        ),
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
                  border: Border.all(color: AppColors.gray200),
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
                if (widget.hideCommercialStatus) {
                  next.remove('status');
                }
                // UI is bucket-based; drop legacy funnel-stage filter keys.
                next.remove('purchaseFunnelStage');
                if (widget.hidePurchaseFunnel) {
                  next.remove('purchaseBucket');
                }
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
                  color: AppColors.navyBright,
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
  final bool hideCommercialStatus;
  final bool hidePurchaseFunnel;
  final ValueChanged<String> onSelectStatus;
  final ValueChanged<String> onTogglePurchaseBucket;
  final ValueChanged<String> onSelectProfile;
  final VoidCallback onOpenSpecialty;
  final TextEditingController minimumIntervalController;
  final TextEditingController maximumIntervalController;
  final VoidCallback onIntervalChanged;
  final ValueChanged<double> onSelectRadius;

  const _ClinicFilters({
    required this.local,
    required this.radiusKm,
    this.hideCommercialStatus = false,
    this.hidePurchaseFunnel = false,
    required this.onSelectStatus,
    required this.onTogglePurchaseBucket,
    required this.onSelectProfile,
    required this.onOpenSpecialty,
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
        if (!hideCommercialStatus) ...[
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
        ],
        const _SectionHeader(title: 'Especialidade'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: _SpecialtyNavRow(
            count: local['serviceCodes']?.length ?? 0,
            onTap: onOpenSpecialty,
          ),
        ),
        if (!hidePurchaseFunnel) ...[
          const _SectionHeader(title: 'Status de compras'),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: PurchaseBucketFilter.values.map((bucket) {
                final selected = (local['purchaseBucket'] ?? []).contains(
                  bucket,
                );
                final color = PurchaseBucketFilter.color(bucket);
                return _ToggleChip(
                  label: PurchaseBucketFilter.label(bucket),
                  dotColor: color,
                  selected: selected,
                  onTap: () => onTogglePurchaseBucket(bucket),
                );
              }).toList(),
            ),
          ),
        ],
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

class _SpecialtyNavRow extends StatelessWidget {
  const _SpecialtyNavRow({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final subtitle = count == 0
        ? 'Todas'
        : '$count selecionada${count == 1 ? '' : 's'}';

    return Material(
      color: AppColors.surfaceTertiary,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.gray200),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.medical_services_outlined,
                size: 18,
                color: AppColors.navyBright,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Escolher especialidades',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                        color: count > 0
                            ? AppColors.navyBright
                            : AppColors.gray500,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.gray400),
            ],
          ),
        ),
      ),
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
          color: selected ? dotColor.withValues(alpha: 0.1) : AppColors.gray100,
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
                color: selected ? dotColor : AppColors.gray700,
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
          color: selected ? AppColors.navyBright : AppColors.gray100,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? AppColors.navyBright : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.gray700,
          ),
        ),
      ),
    );
  }
}
