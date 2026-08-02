import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_payer_shares_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

double _parsePercent(String raw) {
  final cleaned = raw.trim().replaceAll('%', '').replaceAll(',', '.');
  return double.tryParse(cleaned) ?? 0;
}

String _formatPercent(double value) {
  final clamped = value.clamp(0.0, 100.0);
  final cents = (clamped * 100).round();
  final whole = cents ~/ 100;
  final frac = cents % 100;
  if (frac == 0) return '$whole';
  if (frac % 10 == 0) return '$whole.${frac ~/ 10}';
  return '$whole.${frac.toString().padLeft(2, '0')}';
}

bool _percentsEqual(double a, double b) => (a - b).abs() < 0.005;

/// Full-screen editor for Fontes Pagadoras (payer mix).
/// Returns the updated [List<PayerShare>] on save, or `null` if cancelled.
///
/// [catalog] is the healthcare-provider picker list (`GET /healthcare-providers`).
class EditPayerSourcesScreen extends StatefulWidget {
  const EditPayerSourcesScreen({
    super.key,
    required this.initialPayers,
    this.catalog = mockPayerCatalog,
  });

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
            type: p.type,
            isPackage: p.isPackage,
            percentCtrl: TextEditingController(
              text: _formatPercent(p.sharePercent),
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

  double get _totalPercent {
    var sum = 0.0;
    for (final p in _payers) {
      sum += _parsePercent(p.percentCtrl.text);
    }
    return (sum * 100).round() / 100;
  }

  bool get _isBalanced =>
      _payers.isEmpty || _percentsEqual(_totalPercent, 100);

  bool get _hasZeroShare =>
      _payers.any((p) => _parsePercent(p.percentCtrl.text) <= 0);

  Set<String> get _usedNames =>
      _payers.map((p) => p.name.toLowerCase()).toSet();

  @override
  Widget build(BuildContext context) {
    final total = _totalPercent;
    final balanced = _isBalanced;
    final hasZero = _hasZeroShare;

    return Scaffold(
      backgroundColor: AppColors.surfaceTertiary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.gray900,
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
        backgroundColor: AppColors.navyBright,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Adicionar'),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
            child: _TotalChip(
              total: total,
              balanced: balanced,
              isEmpty: _payers.isEmpty,
              hasZeroShare: hasZero,
            ),
          ),
          const Divider(height: 1, color: AppColors.surfaceSecondary),
          Expanded(
            child: _payers.isEmpty
                ? const _EmptyEditor()
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                    itemCount: _payers.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      return _PayerEditCard(
                        payer: _payers[i],
                        color: payerShareColorForIndex(i),
                        onChanged: () => setState(() {}),
                        onPackageChanged: (value) {
                          setState(() => _payers[i].isPackage = value);
                        },
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

    setState(() {
      for (final entry in selected) {
        _payers.add(
          _EditablePayer(
            id: entry.id,
            name: entry.name,
            type: entry.type,
            isPackage: false,
            percentCtrl: TextEditingController(text: '0'),
          ),
        );
      }
    });

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          selected.length == 1
              ? '${selected.first.name} adicionada com 0% — ajuste o percentual'
              : '${selected.length} fontes adicionadas com 0% — ajuste os percentuais',
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
          ? 'A soma está em ${_formatPercent(total)}%. '
                'Remova ${_formatPercent(total - 100)}%.'
          : 'A soma está em ${_formatPercent(total)}%. '
                'Falta ${_formatPercent(100 - total)}%.';
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
            sharePercent: _parsePercent(p.percentCtrl.text),
            isPackage: p.isPackage,
            type: p.type,
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
    this.type,
    this.isPackage = false,
  });

  final String id;
  final String name;
  final String? type;
  final TextEditingController percentCtrl;
  bool isPackage;
}

class _TotalChip extends StatelessWidget {
  const _TotalChip({
    required this.total,
    required this.balanced,
    required this.isEmpty,
    required this.hasZeroShare,
  });

  final double total;
  final bool balanced;
  final bool isEmpty;
  final bool hasZeroShare;

  @override
  Widget build(BuildContext context) {
    final ok = isEmpty || (balanced && !hasZeroShare);
    final bg = ok ? const Color(0xFFecfdf5) : AppColors.red50;
    final fg = ok ? AppColors.green600 : AppColors.red;
    final String label;
    if (isEmpty) {
      label = 'Nenhuma fonte — salve para limpar o cadastro';
    } else if (hasZeroShare) {
      label = 'Há fontes com 0% — ajuste ou remova antes de salvar';
    } else if (balanced) {
      label = 'Soma: 100% — pronto para salvar';
    } else if (total > 100) {
      label =
          'Soma: ${_formatPercent(total)}% — remova ${_formatPercent(total - 100)}%';
    } else {
      label =
          'Soma: ${_formatPercent(total)}% — falta ${_formatPercent(100 - total)}%';
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
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
        ],
      ),
    );
  }
}

class _EmptyEditor extends StatelessWidget {
  const _EmptyEditor();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.pie_chart_outline_rounded,
              size: 40,
              color: AppColors.gray400,
            ),
            SizedBox(height: 14),
            Text(
              'Nenhuma fonte pagadora',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Toque em Adicionar para incluir convênios, SUS, particular '
              'e outras fontes. Novas fontes entram com 0% — ajuste a soma para 100%.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.gray500,
                height: 1.4,
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
    required this.onPackageChanged,
    required this.onRemove,
  });

  final _EditablePayer payer;
  final Color color;
  final VoidCallback onChanged;
  final ValueChanged<bool> onPackageChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final percent = _parsePercent(payer.percentCtrl.text);
    final isZero = percent <= 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isZero ? AppColors.red100 : AppColors.surfaceSecondary,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
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
              _PercentStepper(
                controller: payer.percentCtrl,
                onChanged: onChanged,
              ),
              IconButton(
                onPressed: onRemove,
                icon: const Icon(Icons.delete_outline_rounded, size: 20),
                color: AppColors.gray400,
                tooltip: 'Remover',
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const SizedBox(width: 22),
              const Expanded(
                child: Text(
                  'Pacote',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.gray600,
                  ),
                ),
              ),
              Switch.adaptive(
                value: payer.isPackage,
                onChanged: onPackageChanged,
                activeTrackColor: AppColors.navyBright,
              ),
            ],
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

  void _nudge(double delta) {
    final current = _parsePercent(controller.text);
    final next = ((current + delta) * 100).round() / 100;
    controller.text = _formatPercent(next.clamp(0, 100));
    onChanged();
  }

  Future<void> _openPicker(BuildContext context) async {
    final picked = await showModalBottomSheet<double>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _PercentPickerSheet(
        initialValue: _parsePercent(controller.text),
      ),
    );
    if (picked == null) return;
    controller.text = _formatPercent(picked);
    onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final label = '${_formatPercent(_parsePercent(controller.text))}%';
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _HoldStepButton(
          icon: Icons.remove_rounded,
          onStep: () => _nudge(-1),
        ),
        const SizedBox(width: 4),
        Material(
          color: AppColors.gray100,
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            onTap: () => _openPicker(context),
            borderRadius: BorderRadius.circular(10),
            child: Container(
              constraints: const BoxConstraints(minWidth: 64),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              alignment: Alignment.center,
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 4),
        _HoldStepButton(
          icon: Icons.add_rounded,
          onStep: () => _nudge(1),
        ),
      ],
    );
  }
}

class _HoldStepButton extends StatefulWidget {
  const _HoldStepButton({required this.icon, required this.onStep});

  final IconData icon;
  final VoidCallback onStep;

  @override
  State<_HoldStepButton> createState() => _HoldStepButtonState();
}

class _HoldStepButtonState extends State<_HoldStepButton> {
  Timer? _holdTimer;
  Timer? _repeatTimer;

  void _startHold() {
    widget.onStep();
    _holdTimer?.cancel();
    _repeatTimer?.cancel();
    _holdTimer = Timer(const Duration(milliseconds: 350), () {
      _repeatTimer = Timer.periodic(const Duration(milliseconds: 70), (_) {
        widget.onStep();
      });
    });
  }

  void _stopHold() {
    _holdTimer?.cancel();
    _repeatTimer?.cancel();
    _holdTimer = null;
    _repeatTimer = null;
  }

  @override
  void dispose() {
    _stopHold();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _startHold(),
      onPointerUp: (_) => _stopHold(),
      onPointerCancel: (_) => _stopHold(),
      child: Container(
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.gray100,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(widget.icon, size: 18, color: AppColors.gray600),
      ),
    );
  }
}

class _PercentPickerSheet extends StatefulWidget {
  const _PercentPickerSheet({required this.initialValue});

  final double initialValue;

  @override
  State<_PercentPickerSheet> createState() => _PercentPickerSheetState();
}

class _PercentPickerSheetState extends State<_PercentPickerSheet> {
  late int _whole;
  late int _frac;
  late final FixedExtentScrollController _wholeCtrl;
  late final FixedExtentScrollController _fracCtrl;

  @override
  void initState() {
    super.initState();
    final cents = (_parsePercent(_formatPercent(widget.initialValue)) * 100)
        .round()
        .clamp(0, 10000);
    _whole = cents ~/ 100;
    _frac = cents % 100;
    if (_whole >= 100) {
      _whole = 100;
      _frac = 0;
    }
    _wholeCtrl = FixedExtentScrollController(initialItem: _whole);
    _fracCtrl = FixedExtentScrollController(initialItem: _frac);
  }

  @override
  void dispose() {
    _wholeCtrl.dispose();
    _fracCtrl.dispose();
    super.dispose();
  }

  double get _value => _whole + (_frac / 100);

  void _onWholeChanged(int value) {
    setState(() {
      _whole = value;
      if (_whole >= 100) {
        _frac = 0;
        _fracCtrl.jumpToItem(0);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 12, 20, 12 + bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.gray200,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Percentual',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Selecione até duas casas decimais',
              style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 180,
              child: Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: CupertinoPicker(
                      scrollController: _wholeCtrl,
                      itemExtent: 36,
                      onSelectedItemChanged: _onWholeChanged,
                      children: [
                        for (var i = 0; i <= 100; i++)
                          Center(
                            child: Text(
                              '$i',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const Text(
                    ',',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray900,
                    ),
                  ),
                  Expanded(
                    flex: 2,
                    child: CupertinoPicker(
                      scrollController: _fracCtrl,
                      itemExtent: 36,
                      onSelectedItemChanged: (v) {
                        if (_whole >= 100) {
                          _fracCtrl.jumpToItem(0);
                          setState(() => _frac = 0);
                          return;
                        }
                        setState(() => _frac = v);
                      },
                      children: [
                        for (var i = 0; i < 100; i++)
                          Center(
                            child: Text(
                              i.toString().padLeft(2, '0'),
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w600,
                                color: _whole >= 100
                                    ? AppColors.gray300
                                    : AppColors.gray900,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.only(left: 4, right: 12),
                    child: Text(
                      '%',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${_formatPercent(_value)}%',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.navyBright,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context, _value.clamp(0, 100)),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.navyBright,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Confirmar'),
              ),
            ),
          ],
        ),
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
  late List<PayerCatalogEntry> _catalog;
  final Set<String> _selectedIds = {};

  @override
  void initState() {
    super.initState();
    _queryCtrl = TextEditingController();
    _catalog = List<PayerCatalogEntry>.from(widget.catalog);
  }

  @override
  void dispose() {
    _queryCtrl.dispose();
    super.dispose();
  }

  List<PayerCatalogEntry> get _pool => _catalog
      .where((e) => !widget.usedNames.contains(e.name.toLowerCase()))
      .toList();

  List<PayerCatalogEntry> get _filtered {
    final q = _queryCtrl.text.trim().toLowerCase();
    final base = _pool;
    if (q.isEmpty) return base;
    return base.where((e) => e.name.toLowerCase().contains(q)).toList();
  }

  /// Sectioned list: selected on top, then disponíveis (like doctors sheet).
  List<Object> get _sectionedItems {
    final fd = _filtered;
    if (fd.isEmpty) return const [];

    final selected = fd.where((e) => _selectedIds.contains(e.id)).toList();
    final available = fd.where((e) => !_selectedIds.contains(e.id)).toList();

    final items = <Object>[];
    if (selected.isNotEmpty) {
      items.add('_section_header_selected');
      items.addAll(selected);
    }
    if (available.isNotEmpty) {
      if (selected.isNotEmpty) items.add('_section_divider');
      items.add('_section_header_available');
      items.addAll(available);
    }
    return items;
  }

  Future<void> _createFonte() async {
    final created = await showModalBottomSheet<PayerCatalogEntry>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _CreatePayerSourceSheet(
        initialName: _queryCtrl.text.trim(),
        existingNames: {
          ...widget.usedNames,
          ..._catalog.map((e) => e.name.toLowerCase()),
        },
      ),
    );
    if (created == null || !mounted) return;

    setState(() {
      if (!_catalog.any((e) => e.id == created.id)) {
        _catalog = [created, ..._catalog];
      }
      _selectedIds.add(created.id);
      _queryCtrl.clear();
    });
  }

  void _confirm() {
    final byId = {for (final e in _catalog) e.id: e};
    final picked = _selectedIds
        .map((id) => byId[id])
        .whereType<PayerCatalogEntry>()
        .toList(growable: false);
    Navigator.pop(context, picked);
  }

  Widget _sectionHeader(String label) {
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
    final filtered = _filtered;
    final sectioned = _sectionedItems;
    final height = MediaQuery.sizeOf(context).height * 0.78;
    final query = _queryCtrl.text.trim();

    return SizedBox(
      height: height,
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.gray200,
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
                  'Selecione uma ou mais fontes. Novas entradas começam '
                  'com 0% — os percentuais das demais não mudam.',
                  style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _queryCtrl,
                  autofocus: false,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Buscar fonte pagadora…',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    filled: true,
                    fillColor: AppColors.gray100,
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
                        _pool.isEmpty
                            ? 'Todas as fontes do catálogo já foram adicionadas. '
                                'Crie uma nova abaixo.'
                            : query.isEmpty
                            ? 'Nenhuma fonte disponível.'
                            : 'Nada encontrado para "$query". '
                                'Tente outro termo ou crie uma fonte.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13.5,
                          color: AppColors.gray400,
                          height: 1.4,
                        ),
                      ),
                    ),
                  )
                : ListView.builder(
                    itemCount: sectioned.length,
                    itemBuilder: (_, i) {
                      final item = sectioned[i];
                      if (item is String) {
                        switch (item) {
                          case '_section_header_selected':
                            return _sectionHeader('Selecionados');
                          case '_section_header_available':
                            return _sectionHeader('Disponíveis');
                          case '_section_divider':
                            return const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 20),
                              child: Divider(
                                height: 1,
                                color: AppColors.surfaceSecondary,
                              ),
                            );
                          default:
                            return const SizedBox.shrink();
                        }
                      }

                      final entry = item as PayerCatalogEntry;
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
                        activeColor: AppColors.navyBright,
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
            child: Column(
              children: [
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _createFonte,
                    icon: const Icon(Icons.add_business_rounded, size: 18),
                    label: const Text('Criar fonte pagadora'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.navyBright,
                      side: const BorderSide(color: AppColors.blueLight),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _selectedIds.isEmpty ? null : _confirm,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.navyBright,
                      disabledBackgroundColor: AppColors.gray200,
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
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CreatePayerSourceSheet extends StatefulWidget {
  const _CreatePayerSourceSheet({
    required this.existingNames,
    this.initialName = '',
  });

  final Set<String> existingNames;
  final String initialName;

  @override
  State<_CreatePayerSourceSheet> createState() =>
      _CreatePayerSourceSheetState();
}

class _CreatePayerSourceSheetState extends State<_CreatePayerSourceSheet> {
  late final TextEditingController _nameCtrl;
  String _type = 'PRIVATE';
  bool _saving = false;
  String? _error;

  static const _types = <(String, String)>[
    ('PRIVATE', 'Particular / plano'),
    ('PUBLIC', 'Público / SUS'),
    ('MIXED', 'Misto'),
    ('OTHER', 'Outros'),
  ];

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.initialName);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Informe o nome da fonte');
      return;
    }
    if (widget.existingNames.contains(name.toLowerCase())) {
      setState(() => _error = 'Já existe uma fonte com este nome');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final repo = HealthcareProvidersRepository();
    try {
      final created = await repo.createProvider(name: name, type: _type);
      if (!mounted) return;
      Navigator.pop(context, created.toCatalogEntry());
    } catch (e) {
      if (!mounted) return;
      final message = e is FacilityPayerSharesException
          ? (e.message ?? 'Falha ao criar fonte')
          : 'Falha ao criar fonte pagadora';
      setState(() {
        _saving = false;
        _error = message;
      });
    } finally {
      repo.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.gray200,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const Text(
              'Nova fonte pagadora',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'A fonte entra no catálogo e fica selecionada para adicionar.',
              style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nameCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText: 'Nome',
                filled: true,
                fillColor: AppColors.gray100,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
            ),
            const SizedBox(height: 14),
            const Text(
              'Tipo',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray500,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final (value, label) in _types)
                  FilterChip(
                    label: Text(label),
                    selected: _type == value,
                    onSelected: _saving
                        ? null
                        : (_) => setState(() => _type = value),
                    selectedColor: AppColors.navyBright.withValues(alpha: 0.15),
                    checkmarkColor: AppColors.navyBright,
                    labelStyle: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: _type == value
                          ? AppColors.navyBright
                          : AppColors.gray700,
                    ),
                  ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.error,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _saving ? null : _save,
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
                  : const Text('Criar e selecionar'),
            ),
          ],
        ),
      ),
    );
  }
}
