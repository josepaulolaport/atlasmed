import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_potential_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_potential_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_section_header.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Potencial & share — per-Linha potential fields + AtlasMed qty + penetration.
class ClinicPotentialSection extends ConsumerWidget {
  const ClinicPotentialSection({
    super.key,
    required this.facilityId,
    required this.canEdit,
  });

  final int facilityId;
  final bool canEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verticalId = ref.watch(clinicDetailActiveLinhaIdProvider(facilityId));
    final async = ref.watch(clinicDetailPotentialsProvider(facilityId));
    final hasFields = async.asData?.value?.items.isNotEmpty ?? false;
    final editVerticalId = canEdit && hasFields ? verticalId : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClinicSectionHeader(
          title: 'Potencial & share',
          trailing: editVerticalId == null
              ? null
              : TextButton(
                  onPressed: () => _openEditor(
                    context,
                    ref,
                    facilityId: facilityId,
                    verticalId: editVerticalId,
                  ),
                  child: const Text(
                    'Editar potencial',
                    style: TextStyle(
                      fontSize: 14,
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
              style: TextStyle(
                fontSize: 14,
                height: 1.4,
                color: AppColors.gray500,
              ),
            ),
          )
        else
          async.when(
            loading: () => const ClinicDetailCard(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ),
            ),
            error: (err, _) => ClinicDetailCard(
              child: Column(
                children: [
                  Text(
                    'Não foi possível carregar potencial.',
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.gray500,
                    ),
                  ),
                  TextButton(
                    onPressed: () => ref.invalidate(
                      clinicDetailPotentialsProvider(facilityId),
                    ),
                    child: const Text('Tentar de novo'),
                  ),
                ],
              ),
            ),
            data: (page) {
              if (page == null || page.items.isEmpty) {
                return const ClinicaEmptySection(
                  icon: Icons.insights_outlined,
                  title: 'Nenhum campo de potencial configurado',
                  description:
                      'Os campos de potencial desta linha aparecerão aqui quando forem configurados.',
                );
              }
              return ClinicDetailCard(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                child: Column(
                  children: [
                    for (var i = 0; i < page.items.length; i++) ...[
                      if (i > 0)
                        const Divider(height: 20, color: AppColors.gray100),
                      _PotentialRow(item: page.items[i]),
                    ],
                  ],
                ),
              );
            },
          ),
      ],
    );
  }

  Future<void> _openEditor(
    BuildContext context,
    WidgetRef ref, {
    required int facilityId,
    required int verticalId,
  }) async {
    final page = await ref.read(
      facilityPotentialsProvider((
        facilityId: facilityId,
        verticalId: verticalId,
      )).future,
    );
    if (!context.mounted) return;
    if (page.items.isEmpty) return;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _EditPotentialSheet(
        facilityId: facilityId,
        verticalId: verticalId,
        items: page.items,
      ),
    );
    if (saved == true) {
      ref.invalidate(clinicDetailPotentialsProvider(facilityId));
      ref.invalidate(
        facilityPotentialsProvider((
          facilityId: facilityId,
          verticalId: verticalId,
        )),
      );
    }
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
            fontSize: 15,
            height: 1.25,
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
                label: 'AtlasMed/mês',
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
            fontSize: 12,
            height: 1.25,
            fontWeight: FontWeight.w500,
            color: AppColors.gray500,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 16,
            height: 1.2,
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
  const _EditPotentialSheet({
    required this.facilityId,
    required this.verticalId,
    required this.items,
  });

  final int facilityId;
  final int verticalId;
  final List<FacilityPotentialItem> items;

  @override
  State<_EditPotentialSheet> createState() => _EditPotentialSheetState();
}

class _EditPotentialSheetState extends State<_EditPotentialSheet> {
  late final Map<int, TextEditingController> _controllers;
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
    final values = <({int definitionId, double? quantity})>[];
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

    final repo = FacilityPotentialRepository(
      facilityId: widget.facilityId,
      verticalId: widget.verticalId,
    );
    try {
      await repo.patchValues(values);
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Não foi possível salvar. Tente novamente.';
          _saving = false;
        });
      }
    } finally {
      repo.dispose();
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
