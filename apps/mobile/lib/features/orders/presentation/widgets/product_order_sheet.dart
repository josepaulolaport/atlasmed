import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/orders/data/catalog_product.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/models.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/tracking.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/legacy_orders_mock.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';

/// Bottom-sheet modal for setting quantity + unit price on a product.
class ProductOrderSheet extends ConsumerStatefulWidget {
  final CatalogProduct product;
  final String? clinicId;
  final String? clinicName;
  final int initialQty;
  final double? initialUnit;
  final String? initialMode;

  const ProductOrderSheet({
    super.key,
    required this.product,
    this.clinicId,
    this.clinicName,
    this.initialQty = 0,
    this.initialUnit,
    this.initialMode,
  });

  @override
  ConsumerState<ProductOrderSheet> createState() => _ProductOrderSheetState();
}

class _ProductOrderSheetState extends ConsumerState<ProductOrderSheet> {
  late int _qty;
  late String _mode; // 'suggested', 'catalog', 'custom'
  late double _customUnit;

  PriceSuggestion? get _suggestion => widget.clinicId != null
      ? getSuggestedPrice(
          widget.clinicId!,
          widget.product.id,
          widget.product.price,
        )
      : null;

  double get _activeUnit {
    switch (_mode) {
      case 'suggested':
        return _suggestion?.unit ?? widget.product.price;
      case 'catalog':
        return widget.product.price;
      default:
        return _customUnit;
    }
  }

  @override
  void initState() {
    super.initState();
    final suggestion = widget.clinicId != null
        ? getSuggestedPrice(
            widget.clinicId!,
            widget.product.id,
            widget.product.price,
          )
        : null;
    final startMode =
        widget.initialMode ?? (suggestion != null ? 'suggested' : 'catalog');
    final startUnit =
        widget.initialUnit ??
        (startMode == 'suggested' && suggestion != null
            ? suggestion.unit
            : widget.product.price);
    _qty = widget.initialQty > 0 ? widget.initialQty : 1;
    _mode = startMode;
    _customUnit = startUnit;
  }

  void _confirm() {
    ref
        .read(cartProvider.notifier)
        .addItem(
          productId: widget.product.id,
          productName: widget.product.name,
          productSubtitle: widget.product.subtitle,
          qty: _qty,
          unitPrice: _activeUnit,
          catalogUnitPrice: widget.product.price,
          priceMode: _mode,
        );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final suggestion = _suggestion;
    final subtotal = _activeUnit * _qty;
    final isCustomBelowFloor =
        _mode == 'custom' &&
        suggestion != null &&
        _customUnit < suggestion.unit * 0.9;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 10),
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFe5e7eb),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0xFFeef0f3))),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ProductIcon(name: widget.product.name, size: 42),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Adicionar ao pedido',
                        style: TextStyle(
                          fontSize: 9.5,
                          color: Color(0xFF8a94a6),
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.product.name,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0f1729),
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.product.subtitle,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6b7280),
                        ),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 30,
                    height: 30,
                    decoration: const BoxDecoration(
                      color: Color(0xFFf3f4f6),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close,
                      size: 14,
                      color: Color(0xFF6b7280),
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Scrollable content
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Clinic context
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 11,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color: widget.clinicId != null
                          ? const Color(0xFFeef2ff)
                          : const Color(0xFFfef3e1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: widget.clinicId != null
                            ? const Color(0x1F0a2f7f)
                            : const Color(0x33c6861b),
                      ),
                    ),
                    child: Row(
                      children: [
                        Text(
                          widget.clinicId != null ? '🏥' : '⚠️',
                          style: const TextStyle(fontSize: 14),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: widget.clinicId != null
                              ? RichText(
                                  text: TextSpan(
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      height: 1.4,
                                    ),
                                    children: [
                                      const TextSpan(
                                        text: 'Clínica destinatária · ',
                                        style: TextStyle(
                                          color: Color(0xFF6b7280),
                                        ),
                                      ),
                                      TextSpan(
                                        text: widget.clinicName,
                                        style: const TextStyle(
                                          color: Color(0xFF0f1729),
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              : const Text(
                                  'Selecione uma clínica para ver preços negociados',
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    color: Color(0xFFa85a05),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Quantity
                  const Text(
                    'Quantidade',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF8a94a6),
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 9),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFeef0f3)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        _qtyBtn(
                          '-',
                          () => setState(() => _qty = (_qty - 1).clamp(1, 999)),
                          _qty > 1,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            initialValue: '$_qty',
                            textAlign: TextAlign.center,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0f1729),
                              letterSpacing: -0.4,
                            ),
                            decoration: const InputDecoration(
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                            ),
                            onChanged: (v) {
                              final n = int.tryParse(v);
                              if (n != null && n >= 1) setState(() => _qty = n);
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        _qtyBtn('+', () => setState(() => _qty++), true),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [5, 10, 25, 50].map((preset) {
                      final active = _qty == preset;
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: GestureDetector(
                            onTap: () => setState(() => _qty = preset),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 7),
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: active
                                      ? const Color(0xFF0a2f7f)
                                      : const Color(0xFFeef0f3),
                                ),
                                borderRadius: BorderRadius.circular(8),
                                color: active
                                    ? const Color(0xFFeef2ff)
                                    : Colors.white,
                              ),
                              child: Text(
                                '$preset×',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: active
                                      ? const Color(0xFF0a2f7f)
                                      : const Color(0xFF6b7280),
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 18),
                  // Unit price
                  Row(
                    children: [
                      const Text(
                        'Preço unitário',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF8a94a6),
                          letterSpacing: 0.8,
                        ),
                      ),
                      const Spacer(),
                      if (suggestion != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFe7f6ef),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.access_time,
                                size: 9,
                                color: Color(0xFF0f7c5a),
                              ),
                              SizedBox(width: 3),
                              Text(
                                'Histórico desta clínica',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0f7c5a),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 9),
                  // Price rows
                  if (suggestion != null)
                    _PriceRow(
                      active: _mode == 'suggested',
                      onTap: () => setState(() => _mode = 'suggested'),
                      label: 'Preço sugerido',
                      hint:
                          'Última agreement · ${_fmtDateLong(suggestion.date)} · ${_agreementLabel(suggestion.kind)}',
                      price: brl(suggestion.unit),
                      badge: suggestion.isDiscounted
                          ? '−${suggestion.discountPct}% vs tabela'
                          : null,
                      badgeGood: true,
                    ),
                  if (suggestion != null) const SizedBox(height: 8),
                  _PriceRow(
                    active: _mode == 'catalog',
                    onTap: () => setState(() => _mode = 'catalog'),
                    label: 'Preço de tabela',
                    hint: 'Tabela vigente para todos os clientes',
                    price: brl(widget.product.price),
                  ),
                  const SizedBox(height: 8),
                  _PriceRow(
                    active: _mode == 'custom',
                    onTap: () => setState(() => _mode = 'custom'),
                    label: 'Preço personalizado',
                    hint: isCustomBelowFloor
                        ? '⚠ Abaixo do teto de desconto · sujeito a aprovação'
                        : 'Definir manualmente',
                    hintWarn: isCustomBelowFloor,
                    priceWidget: SizedBox(
                      width: 92,
                      child: TextFormField(
                        initialValue: _customUnit
                            .toStringAsFixed(2)
                            .replaceAll('.', ','),
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: _mode == 'custom'
                              ? const Color(0xFF0a2f7f)
                              : const Color(0xFF0f1729),
                        ),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        onChanged: (v) {
                          final cleaned = v.replaceAll(',', '.');
                          final n = double.tryParse(cleaned);
                          if (n != null) {
                            setState(() {
                              _customUnit = n;
                              _mode = 'custom';
                            });
                          }
                        },
                        onTap: () => setState(() => _mode = 'custom'),
                      ),
                    ),
                    prefix: 'R\$',
                  ),
                  const SizedBox(height: 12),
                  // History
                  if (suggestion != null && suggestion.history.length > 1)
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFFeef0f3)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: ExpansionTile(
                        tilePadding: const EdgeInsets.symmetric(horizontal: 14),
                        childrenPadding: EdgeInsets.zero,
                        title: const Row(
                          children: [
                            Icon(
                              Icons.access_time,
                              size: 13,
                              color: Color(0xFF6b7280),
                            ),
                            SizedBox(width: 7),
                            Text(
                              'Histórico de negociação',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF0f1729),
                              ),
                            ),
                          ],
                        ),
                        trailing: Text(
                          '${suggestion.history.length} agreements',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF9ca3af),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        children: [
                          const Divider(height: 1, color: Color(0xFFeef0f3)),
                          ...suggestion.history.asMap().entries.map((entry) {
                            final h = entry.value;
                            final isFirst = entry.key == 0;
                            final metaKind = h.kind;
                            return Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 9,
                              ),
                              decoration: BoxDecoration(
                                border: isFirst
                                    ? null
                                    : const Border(
                                        top: BorderSide(
                                          color: Color(0xFFf3f4f6),
                                        ),
                                      ),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Text(
                                              brl(h.unit),
                                              style: const TextStyle(
                                                fontSize: 12.5,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFF0f1729),
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            _agreementBadge(metaKind),
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${_fmtDateLong(h.date)} · ${h.qty} un · ${h.orderId}',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: Color(0xFF6b7280),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (isFirst)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 7,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFeef2ff),
                                        borderRadius: BorderRadius.circular(
                                          999,
                                        ),
                                      ),
                                      child: const Text(
                                        'última',
                                        style: TextStyle(
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF0a2f7f),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          // Footer
          Container(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 18),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFeef0f3))),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Subtotal · $_qty ${_qty == 1 ? 'unidade' : 'unidades'}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF8a94a6),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (_mode == 'suggested' &&
                            suggestion != null &&
                            suggestion.isDiscounted)
                          Text(
                            'Economia: ${brl((widget.product.price - suggestion.unit) * _qty)}',
                            style: const TextStyle(
                              fontSize: 10.5,
                              color: Color(0xFF0f7c5a),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                    const Spacer(),
                    Text(
                      brl(subtotal),
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0a2f7f),
                        letterSpacing: -0.4,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _confirm,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0a2f7f),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 4,
                      shadowColor: const Color(0x330a2f7f),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.shopping_bag_outlined, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          widget.initialQty > 0
                              ? 'Atualizar item'
                              : 'Adicionar ao carrinho',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
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

  Widget _qtyBtn(String label, VoidCallback onTap, bool enabled) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFeef0f3)),
          borderRadius: BorderRadius.circular(10),
          color: const Color(0xFFf7f8fb),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: enabled
                  ? const Color(0xFF0a2f7f)
                  : const Color(0xFFcbd5e1),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Price row widget ─────────────────────────────────────────
class _PriceRow extends StatelessWidget {
  final bool active;
  final VoidCallback onTap;
  final String label;
  final String hint;
  final String? price;
  final Widget? priceWidget;
  final String? badge;
  final bool badgeGood;
  final bool hintWarn;
  final String? prefix;

  const _PriceRow({
    required this.active,
    required this.onTap,
    required this.label,
    required this.hint,
    this.price,
    this.priceWidget,
    this.badge,
    this.badgeGood = false,
    this.hintWarn = false,
    this.prefix,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          border: Border.all(
            color: active ? const Color(0xFF0a2f7f) : const Color(0xFFeef0f3),
          ),
          borderRadius: BorderRadius.circular(12),
          color: active ? const Color(0xFFeef2ff) : Colors.white,
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: active
                      ? const Color(0xFF0a2f7f)
                      : const Color(0xFFcbd5e1),
                ),
                color: Colors.white,
              ),
              child: active
                  ? Center(
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: const BoxDecoration(
                          color: Color(0xFF0a2f7f),
                          shape: BoxShape.circle,
                        ),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: active
                              ? const Color(0xFF0a2f7f)
                              : const Color(0xFF0f1729),
                        ),
                      ),
                      if (badge != null) ...[
                        const SizedBox(width: 7),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 1,
                          ),
                          decoration: BoxDecoration(
                            color: badgeGood
                                ? const Color(0xFFe7f6ef)
                                : const Color(0xFFf3f4f6),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            badge!,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: badgeGood
                                  ? const Color(0xFF0f7c5a)
                                  : const Color(0xFF6b7280),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    hint,
                    style: TextStyle(
                      fontSize: 11.5,
                      color: hintWarn
                          ? const Color(0xFFa85a05)
                          : const Color(0xFF6b7280),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (price != null)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (prefix != null)
                    Text(
                      '$prefix ',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF9ca3af),
                      ),
                    ),
                  Text(
                    price!,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: active
                          ? const Color(0xFF0a2f7f)
                          : const Color(0xFF0f1729),
                    ),
                  ),
                ],
              ),
            if (priceWidget != null)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (prefix != null)
                    Text(
                      '$prefix ',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF9ca3af),
                      ),
                    ),
                  priceWidget!,
                ],
              ),
          ],
        ),
      ),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────
const _agreementMeta = {
  'tabela': {
    'label': 'Tabela',
    'color': Color(0xFF6b7280),
    'bg': Color(0xFFf3f4f6),
  },
  'recorrente': {
    'label': 'Cliente recorrente',
    'color': Color(0xFF0f7c5a),
    'bg': Color(0xFFe7f6ef),
  },
  'campanha': {
    'label': 'Campanha',
    'color': Color(0xFFa85a05),
    'bg': Color(0xFFfef3e1),
  },
};

String _agreementLabel(String kind) {
  return _agreementMeta[kind]?['label'] as String? ?? kind;
}

Widget _agreementBadge(String kind) {
  final meta = _agreementMeta[kind];
  if (meta == null) return const SizedBox.shrink();
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
    decoration: BoxDecoration(
      color: meta['bg'] as Color,
      borderRadius: BorderRadius.circular(5),
    ),
    child: Text(
      meta['label'] as String,
      style: TextStyle(
        fontSize: 9,
        fontWeight: FontWeight.w700,
        color: meta['color'] as Color,
      ),
    ),
  );
}

String _fmtDateLong(String d) {
  final parts = d.split('-');
  if (parts.length != 3) return d;
  return '${parts[2]}/${parts[1]}/${parts[0]}';
}
