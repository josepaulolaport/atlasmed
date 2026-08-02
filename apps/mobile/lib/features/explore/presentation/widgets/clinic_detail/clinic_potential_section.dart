import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_section_header.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Potencial & share — per-Linha potential fields + AtlasMed qty + penetration.
class ClinicPotentialSection extends StatelessWidget {
  const ClinicPotentialSection({
    super.key,
    required this.verticalId,
    required this.page,
    required this.canEdit,
    required this.onSave,
  });

  final String? verticalId;
  final FacilityPotentialsPage? page;
  final bool canEdit;
  final Future<void> Function(
    List<({String definitionId, double? quantity})> values,
  )
  onSave;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClinicSectionHeader(
          title: 'Potencial & share',
          trailing: !canEdit || verticalId == null
              ? null
              : TextButton(
                  onPressed: page == null
                      ? null
                      : () => _openEditor(context, page!),
                  child: const Text(
                    'Editar potencial',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.navyBright,
                    ),
                  ),
                ),
        ),
        if (verticalId == null)
          const ClinicDetailCard(
            child: Text(
              'Selecione uma linha comercial para ver o potencial.',
              style: TextStyle(fontSize: 13, color: AppColors.gray400),
            ),
          )
        else if (page == null)
          ClinicDetailCard(
            child: AtlasShimmer(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    height: 14,
                    color: Colors.white,
                  ),
                  const SizedBox(height: 12),
                  Container(width: 180, height: 14, color: Colors.white),
                ],
              ),
            ),
          )
        else if (page!.items.isEmpty)
          const ClinicDetailCard(
            child: Text(
              'Nenhum campo de potencial configurado para esta linha.',
              style: TextStyle(fontSize: 13, color: AppColors.gray400),
            ),
          )
        else
          ClinicDetailCard(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
            child: Column(
              children: [
                for (var i = 0; i < page!.items.length; i++) ...[
                  if (i > 0)
                    const Divider(height: 20, color: AppColors.gray100),
                  _PotentialRow(item: page!.items[i]),
                ],
              ],
            ),
          ),
      ],
    );
  }

  Future<void> _openEditor(
    BuildContext context,
    FacilityPotentialsPage page,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _EditPotentialSheet(items: page.items, onSave: onSave),
    );
  }
}

class _PotentialRow extends StatelessWidget {
  const _PotentialRow({required this.item});

  final FacilityPotentialItem item;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          item.label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppColors.navyDeep,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _Metric(
                label: 'Potencial/mês',
                value: _fmtQty(item.potentialQuantity),
              ),
            ),
            Expanded(
              child: _Metric(
                label: 'Qtd AtlasMed (média/mês)',
                value: _fmtQty(item.atlasmedMonthlyAvgQty),
              ),
            ),
            Expanded(
              child: _Metric(
                label: 'Penetração',
                value: item.penetration == null
                    ? '—'
                    : '${(item.penetration! * 100).toStringAsFixed(0)}%',
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w500,
            color: AppColors.gray400,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.navyDeep,
          ),
        ),
      ],
    );
  }
}

String _fmtQty(double? value) {
  if (value == null) return '—';
  if (value == value.roundToDouble()) return value.toStringAsFixed(0);
  return value.toStringAsFixed(1);
}

class _EditPotentialSheet extends StatefulWidget {
  const _EditPotentialSheet({required this.items, required this.onSave});

  final List<FacilityPotentialItem> items;
  final Future<void> Function(
    List<({String definitionId, double? quantity})> values,
  )
  onSave;

  @override
  State<_EditPotentialSheet> createState() => _EditPotentialSheetState();
}

class _EditPotentialSheetState extends State<_EditPotentialSheet> {
  late final Map<String, TextEditingController> _controllers;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controllers = {
      for (final item in widget.items)
        item.definitionId: TextEditingController(
          text: item.potentialQuantity == null
              ? ''
              : _fmtQty(item.potentialQuantity),
        ),
    };
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final values = <({String definitionId, double? quantity})>[];
    for (final item in widget.items) {
      final raw = _controllers[item.definitionId]!.text.trim().replaceAll(
        ',',
        '.',
      );
      if (raw.isEmpty) {
        values.add((definitionId: item.definitionId, quantity: null));
        continue;
      }
      final parsed = double.tryParse(raw);
      if (parsed == null || parsed < 0) {
        setState(() {
          _saving = false;
          _error = 'Valor inválido em ${item.label}';
        });
        return;
      }
      values.add((definitionId: item.definitionId, quantity: parsed));
    }

    try {
      await widget.onSave(values);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Não foi possível salvar. Tente novamente.';
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Editar potencial',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.navyDeep,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Quantidade mensal estimada por campo (deixe vazio para limpar).',
              style: TextStyle(fontSize: 13, color: AppColors.gray500),
            ),
            const SizedBox(height: 16),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    for (final item in widget.items) ...[
                      TextField(
                        controller: _controllers[item.definitionId],
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                        ],
                        decoration: InputDecoration(
                          labelText: item.label,
                          border: const OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                  ],
                ),
              ),
            ),
            if (_error != null) ...[
              Text(
                _error!,
                style: const TextStyle(color: AppColors.error, fontSize: 13),
              ),
              const SizedBox(height: 8),
            ],
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.navyBright,
                padding: const EdgeInsets.symmetric(vertical: 14),
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
                  : const Text('Salvar'),
            ),
          ],
        ),
      ),
    );
  }
}
