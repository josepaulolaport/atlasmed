import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog_mock.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Full-screen editor for Fontes Pagadoras (payer mix).
/// Returns the updated [List<PayerShare>] on save, or `null` if cancelled.
///
/// [catalog] is the healthcare-provider picker list (`GET /healthcare-providers`).
class EditPayerSourcesScreen extends StatefulWidget {
  const EditPayerSourcesScreen({
    super.key,
    required this.facilityName,
    required this.initialPayers,
    this.catalog = mockPayerCatalog,
  });

  final String facilityName;
  final List<PayerShare> initialPayers;

  /// Healthcare-provider picker list (`GET /healthcare-providers`).
  final List<PayerCatalogEntry> catalog;

  @override
  State<EditPayerSourcesScreen> createState() => _EditPayerSourcesScreenState();
}

class _EditPayerSourcesScreenState extends State<EditPayerSourcesScreen> {
  late List<_EditablePayer> _payers;

  @override
  void initState() {
    super.initState();
    _payers = widget.initialPayers
        .map(
          (p) => _EditablePayer(
            id: p.id,
            name: p.name,
            percentCtrl: TextEditingController(
              text: p.sharePercent.round().toString(),
            ),
          ),
        )
        .toList();
  }

  @override
  void dispose() {
    for (final p in _payers) {
      p.percentCtrl.dispose();
    }
    super.dispose();
  }

  int get _totalPercent {
    var sum = 0;
    for (final p in _payers) {
      sum += int.tryParse(p.percentCtrl.text.trim()) ?? 0;
    }
    return sum;
  }

  bool get _isBalanced => _payers.isEmpty || _totalPercent == 100;

  bool get _hasZeroShare =>
      _payers.any((p) => (int.tryParse(p.percentCtrl.text.trim()) ?? 0) <= 0);

  Set<String> get _usedNames =>
      _payers.map((p) => p.name.toLowerCase()).toSet();

  void _setPercent(_EditablePayer payer, int value) {
    payer.percentCtrl.text = '${value.clamp(0, 100)}';
    payer.percentCtrl.selection = TextSelection.collapsed(
      offset: payer.percentCtrl.text.length,
    );
  }

  /// Splits 100% across all current payers (largest remainder method).
  void _distributeEvenly() {
    if (_payers.isEmpty) return;
    final n = _payers.length;
    final base = 100 ~/ n;
    var remainder = 100 % n;
    for (final p in _payers) {
      final share = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      _setPercent(p, share);
    }
    setState(() {});
  }

  /// After adding [addedCount] new payers at the end, assign them the leftover
  /// % (or redistribute everything if already at/over 100%).
  void _assignSharesAfterAdd(int addedCount) {
    if (addedCount <= 0 || _payers.isEmpty) return;

    final existing = _payers.length - addedCount;
    if (existing <= 0) {
      _distributeEvenly();
      return;
    }

    var existingTotal = 0;
    for (var i = 0; i < existing; i++) {
      existingTotal += int.tryParse(_payers[i].percentCtrl.text.trim()) ?? 0;
    }

    final leftover = 100 - existingTotal;
    if (leftover <= 0) {
      // Already full — redistribute across everyone so new rows get a share.
      _distributeEvenly();
      return;
    }

    final base = leftover ~/ addedCount;
    var remainder = leftover % addedCount;
    for (var i = existing; i < _payers.length; i++) {
      final share = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      _setPercent(_payers[i], share);
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final total = _totalPercent;
    final balanced = _isBalanced;
    final hasZero = _hasZeroShare;

    return Scaffold(
      backgroundColor: const AppColors.surfaceTertiary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const AppColors.gray900,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: const Text(
          'Fontes Pagadoras',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        actions: [
          TextButton(
            onPressed: _onSavePressed,
            child: const Text(
              'Salvar',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAddSheet,
        backgroundColor: const AppColors.navyBright,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Adicionar'),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.facilityName,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.gray500,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Ajuste a participação de cada fonte no faturamento. '
                  'A soma deve ser 100% para salvar.',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.gray500,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 12),
                _TotalChip(
                  total: total,
                  balanced: balanced,
                  isEmpty: _payers.isEmpty,
                  hasZeroShare: hasZero,
                  onDistribute: _payers.length >= 2 ? _distributeEvenly : null,
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.surfaceSecondary),
          Expanded(
            child: _payers.isEmpty
                ? _EmptyEditor(onAdd: _openAddSheet)
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                    itemCount: _payers.length + 1,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      if (i == _payers.length) {
                        return OutlinedButton.icon(
                          onPressed: _openAddSheet,
                          icon: const Icon(Icons.add_rounded, size: 18),
                          label: const Text('Adicionar fonte'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const AppColors.navyBright,
                            side: const BorderSide(color: AppColors.blueLight),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                        );
                      }
                      return _PayerEditCard(
                        payer: _payers[i],
                        color: payerShareColorForIndex(i),
                        onChanged: () => setState(() {}),
                        onRemove: () => _removeAt(i),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  void _removeAt(int index) {
    final removed = _payers.removeAt(index);
    removed.percentCtrl.dispose();
    setState(() {});
  }

  Future<void> _openAddSheet() async {
    final selected = await showModalBottomSheet<List<PayerCatalogEntry>>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) =>
          _AddPayerSourcesSheet(catalog: widget.catalog, usedNames: _usedNames),
    );
    if (selected == null || selected.isEmpty || !mounted) return;

    final before = _payers.length;
    setState(() {
      for (final entry in selected) {
        _payers.add(
          _EditablePayer(
            id: entry.id,
            name: entry.name,
            percentCtrl: TextEditingController(text: '0'),
          ),
        );
      }
    });
    _assignSharesAfterAdd(_payers.length - before);

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          selected.length == 1
              ? '${selected.first.name} adicionada — percentuais ajustados'
              : '${selected.length} fontes adicionadas — percentuais ajustados',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _onSavePressed() {
    final messenger = ScaffoldMessenger.of(context);

    if (_payers.isEmpty) {
      Navigator.of(context).pop(<PayerShare>[]);
      return;
    }

    if (_hasZeroShare) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Todas as fontes precisam ter mais de 0%. '
            'Ajuste ou remova as que estão zeradas.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (!_isBalanced) {
      final total = _totalPercent;
      final hint = total > 100
          ? 'A soma está em $total%. Remova ${total - 100}% ou toque em '
                '“Distribuir igualmente”.'
          : 'A soma está em $total%. Falta ${100 - total}% ou toque em '
                '“Distribuir igualmente”.';
      messenger.showSnackBar(
        SnackBar(content: Text(hint), behavior: SnackBarBehavior.floating),
      );
      return;
    }

    final result = _payers
        .map(
          (p) => PayerShare(
            id: p.id,
            name: p.name,
            sharePercent: (int.tryParse(p.percentCtrl.text.trim()) ?? 0)
                .toDouble(),
          ),
        )
        .toList();
    Navigator.of(context).pop(result);
  }
}

class _EditablePayer {
  _EditablePayer({
    required this.id,
    required this.name,
    required this.percentCtrl,
  });

  final String id;
  final String name;
  final TextEditingController percentCtrl;
}

class _TotalChip extends StatelessWidget {
  const _TotalChip({
    required this.total,
    required this.balanced,
    required this.isEmpty,
    required this.hasZeroShare,
    this.onDistribute,
  });

  final int total;
  final bool balanced;
  final bool isEmpty;
  final bool hasZeroShare;
  final VoidCallback? onDistribute;

  @override
  Widget build(BuildContext context) {
    final ok = isEmpty || (balanced && !hasZeroShare);
    final bg = ok ? const Color(0xFFecfdf5) : const AppColors.red50;
    final fg = ok ? const AppColors.green600 : const AppColors.red;
    final String label;
    if (isEmpty) {
      label = 'Nenhuma fonte — salve para limpar o cadastro';
    } else if (hasZeroShare) {
      label = 'Há fontes com 0% — ajuste ou remova antes de salvar';
    } else if (balanced) {
      label = 'Soma: 100% — pronto para salvar';
    } else if (total > 100) {
      label = 'Soma: $total% — remova ${total - 100}%';
    } else {
      label = 'Soma: $total% — falta ${100 - total}%';
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(
            ok ? Icons.check_circle_rounded : Icons.info_outline_rounded,
            size: 18,
            color: fg,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: fg,
              ),
            ),
          ),
          if (onDistribute != null && !ok) ...[
            const SizedBox(width: 4),
            TextButton(
              onPressed: onDistribute,
              style: TextButton.styleFrom(
                foregroundColor: const AppColors.navyBright,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Distribuir igualmente',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EmptyEditor extends StatelessWidget {
  const _EmptyEditor({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.pie_chart_outline_rounded,
              size: 40,
              color: AppColors.gray400,
            ),
            const SizedBox(height: 14),
            const Text(
              'Nenhuma fonte pagadora',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Adicione convênios, SUS, particular e outras fontes do faturamento. '
              'Os percentuais são distribuídos automaticamente.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.gray500,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Adicionar fonte'),
              style: FilledButton.styleFrom(
                backgroundColor: const AppColors.navyBright,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PayerEditCard extends StatelessWidget {
  const _PayerEditCard({
    required this.payer,
    required this.color,
    required this.onChanged,
    required this.onRemove,
  });

  final _EditablePayer payer;
  final Color color;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final percent = int.tryParse(payer.percentCtrl.text.trim()) ?? 0;
    final isZero = percent <= 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isZero ? const AppColors.red100 : const AppColors.surfaceSecondary,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  payer.name,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray900,
                  ),
                ),
                if (isZero)
                  const Text(
                    '0% — ajuste ou remova',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.error,
                    ),
                  ),
              ],
            ),
          ),
          _PercentStepper(controller: payer.percentCtrl, onChanged: onChanged),
          IconButton(
            onPressed: onRemove,
            icon: const Icon(Icons.delete_outline_rounded, size: 20),
            color: const AppColors.gray400,
            tooltip: 'Remover',
          ),
        ],
      ),
    );
  }
}

class _PercentStepper extends StatelessWidget {
  const _PercentStepper({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final VoidCallback onChanged;

  void _nudge(int delta) {
    final current = int.tryParse(controller.text.trim()) ?? 0;
    final next = (current + delta).clamp(0, 100);
    controller.text = '$next';
    controller.selection = TextSelection.collapsed(
      offset: controller.text.length,
    );
    onChanged();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _StepButton(icon: Icons.remove_rounded, onTap: () => _nudge(-5)),
        SizedBox(
          width: 52,
          child: TextField(
            controller: controller,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(3),
            ],
            onChanged: (_) => onChanged(),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
            decoration: const InputDecoration(
              isDense: true,
              border: InputBorder.none,
              suffixText: '%',
              suffixStyle: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.gray500,
              ),
              contentPadding: EdgeInsets.symmetric(vertical: 8),
            ),
          ),
        ),
        _StepButton(icon: Icons.add_rounded, onTap: () => _nudge(5)),
      ],
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const AppColors.gray100,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 18, color: const AppColors.gray600),
      ),
    );
  }
}

class _AddPayerSourcesSheet extends StatefulWidget {
  const _AddPayerSourcesSheet({required this.catalog, required this.usedNames});

  final List<PayerCatalogEntry> catalog;
  final Set<String> usedNames;

  @override
  State<_AddPayerSourcesSheet> createState() => _AddPayerSourcesSheetState();
}

class _AddPayerSourcesSheetState extends State<_AddPayerSourcesSheet> {
  late final TextEditingController _queryCtrl;
  final Set<String> _selectedIds = {};

  @override
  void initState() {
    super.initState();
    _queryCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _queryCtrl.dispose();
    super.dispose();
  }

  List<PayerCatalogEntry> get _available => widget.catalog
      .where((e) => !widget.usedNames.contains(e.name.toLowerCase()))
      .toList();

  List<PayerCatalogEntry> get _filtered {
    final q = _queryCtrl.text.trim().toLowerCase();
    final base = _available;
    if (q.isEmpty) return base;
    return base.where((e) => e.name.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final height = MediaQuery.sizeOf(context).height * 0.72;

    return SizedBox(
      height: height,
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: const AppColors.gray200,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Adicionar fontes',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Selecione uma ou mais fontes. Os percentuais serão '
                  'ajustados automaticamente.',
                  style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _queryCtrl,
                  // Keep keyboard closed so the catalog stays visible.
                  autofocus: false,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Buscar fonte pagadora…',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    filled: true,
                    fillColor: const AppColors.gray100,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        _available.isEmpty
                            ? 'Todas as fontes do catálogo já foram adicionadas'
                            : 'Nada encontrado para "${_queryCtrl.text.trim()}"',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13.5,
                          color: AppColors.gray400,
                        ),
                      ),
                    ),
                  )
                : ListView.separated(
                    itemCount: filtered.length,
                    separatorBuilder: (_, _) => const Divider(
                      height: 1,
                      indent: 20,
                      color: AppColors.surfaceSecondary,
                    ),
                    itemBuilder: (_, i) {
                      final entry = filtered[i];
                      final selected = _selectedIds.contains(entry.id);
                      return CheckboxListTile(
                        value: selected,
                        onChanged: (v) {
                          setState(() {
                            if (v == true) {
                              _selectedIds.add(entry.id);
                            } else {
                              _selectedIds.remove(entry.id);
                            }
                          });
                        },
                        controlAffinity: ListTileControlAffinity.trailing,
                        title: Text(
                          entry.name,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.gray900,
                          ),
                        ),
                        activeColor: const AppColors.navyBright,
                      );
                    },
                  ),
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
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _selectedIds.isEmpty
                    ? null
                    : () {
                        final picked = widget.catalog
                            .where((e) => _selectedIds.contains(e.id))
                            .toList();
                        Navigator.pop(context, picked);
                      },
                style: FilledButton.styleFrom(
                  backgroundColor: const AppColors.navyBright,
                  disabledBackgroundColor: const AppColors.gray200,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  _selectedIds.isEmpty
                      ? 'Adicionar'
                      : 'Adicionar (${_selectedIds.length})',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
