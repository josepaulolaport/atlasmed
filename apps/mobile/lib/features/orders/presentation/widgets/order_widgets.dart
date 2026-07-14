import 'package:flutter/material.dart';
import '../../data/models.dart';

// ── PStatusChip ──────────────────────────────────────────────
class PStatusChip extends StatelessWidget {
  final OrderStatus status;
  const PStatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final s = status;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: s.bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 5, height: 5, decoration: BoxDecoration(color: s.color, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(s.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: s.color, letterSpacing: 0.3)),
        ],
      ),
    );
  }
}

// ── PTag ─────────────────────────────────────────────────────
class PTag extends StatelessWidget {
  final String? tag;
  const PTag({super.key, this.tag});

  static const _map = {
    'top': {'bg': Color(0x1F16a373), 'color': Color(0xFF0f8a5f), 'label': 'Top'},
    'novo': {'bg': Color(0x1A1e40af), 'color': Color(0xFF1e40af), 'label': 'Novo'},
    'premium': {'bg': Color(0x1Fc6861b), 'color': Color(0xFFb07a10), 'label': 'Premium'},
  };

  @override
  Widget build(BuildContext context) {
    if (tag == null || !_map.containsKey(tag)) return const SizedBox.shrink();
    final s = _map[tag]!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: s['bg'] as Color,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        s['label'] as String,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: s['color'] as Color, letterSpacing: 0.4),
      ),
    );
  }
}

// ── ProductIcon ──────────────────────────────────────────────
class ProductIcon extends StatelessWidget {
  final String name;
  final double size;
  const ProductIcon({super.key, required this.name, this.size = 40});

  static const _palettes = [
    ('Atlas', 220.0),
    ('Cardio', 355.0),
    ('Orto', 145.0),
    ('Vital', 270.0),
    ('Derma', 315.0),
  ];

  @override
  Widget build(BuildContext context) {
    double hue = 220;
    for (final (key, h) in _palettes) {
      if (name.startsWith(key)) { hue = h; break; }
    }
    final hsl = HSLColor.fromAHSL(1, hue, 0.52, 0.93);
    final borderHsl = HSLColor.fromAHSL(1, hue, 0.38, 0.84);
    final textHsl = HSLColor.fromAHSL(1, hue, 0.52, 0.35);
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        color: hsl.toColor(),
        borderRadius: BorderRadius.circular(size / 4),
        border: Border.all(color: borderHsl.toColor()),
      ),
      alignment: Alignment.center,
      child: Text(
        name.substring(0, 2),
        style: TextStyle(fontSize: size * 0.3, fontWeight: FontWeight.w700, color: textHsl.toColor(), letterSpacing: -0.5),
      ),
    );
  }
}

// ── Stepper ──────────────────────────────────────────────────
class StepperWidget extends StatelessWidget {
  final int value;
  final ValueChanged<int> onChange;
  const StepperWidget({super.key, required this.value, required this.onChange});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFeef0f3)),
        borderRadius: BorderRadius.circular(10),
        color: const Color(0xFFf7f8fb),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _btn('-', () => onChange(value - 1), value > 0 ? const Color(0xFF0a2f7f) : const Color(0xFFd1d5db)),
          SizedBox(
            width: 28,
            child: Text('$value', textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1f2937))),
          ),
          _btn('+', () => onChange(value + 1), const Color(0xFF0a2f7f)),
        ],
      ),
    );
  }

  Widget _btn(String label, VoidCallback onTap, Color color) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32, height: 32,
        alignment: Alignment.center,
        child: Text(label, style: TextStyle(fontSize: 18, color: color, height: 1)),
      ),
    );
  }
}

// ── CartBadge ────────────────────────────────────────────────
class CartBadge extends StatelessWidget {
  final int totalQty;
  final double totalValue;
  final VoidCallback? onTap;
  const CartBadge({super.key, required this.totalQty, required this.totalValue, this.onTap});

  @override
  Widget build(BuildContext context) {
    final active = totalQty > 0;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: active ? const EdgeInsets.symmetric(horizontal: 12, vertical: 6) : const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF0a2f7f) : Colors.transparent,
          border: Border.all(color: active ? const Color(0xFF0a2f7f) : const Color(0xFFeef0f3), width: 1.5),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(Icons.shopping_bag_outlined, size: 18, color: active ? Colors.white : const Color(0xFF9ca3af)),
                if (active)
                  Positioned(
                    top: -7, right: -7,
                    child: Container(
                      width: 16, height: 16,
                      decoration: const BoxDecoration(color: Color(0xFF16a373), shape: BoxShape.circle),
                      child: Center(
                        child: Text('$totalQty', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
                    ),
                  ),
              ],
            ),
            if (active) ...[
              const SizedBox(width: 7),
              Text(brl(totalValue), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
            ],
          ],
        ),
      ),
    );
  }
}

// ── SelectorField ────────────────────────────────────────────
class SelectorField extends StatelessWidget {
  final String label;
  final String? value;
  final String placeholder;
  final VoidCallback? onTap;
  final bool disabled;
  const SelectorField({super.key, required this.label, this.value, required this.placeholder, this.onTap, this.disabled = false});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: disabled ? null : onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: disabled ? const Color(0xFFf7f8fb) : Colors.white,
          border: Border.all(color: const Color(0xFFeef0f3)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF9ca3af), fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                  const SizedBox(height: 3),
                  Text(
                    value ?? placeholder,
                    style: TextStyle(fontSize: 14, color: value != null ? const Color(0xFF1f2937) : const Color(0xFFc4c9d2), fontWeight: value != null ? FontWeight.w500 : FontWeight.w400),
                  ),
                ],
              ),
            ),
            const Icon(Icons.keyboard_arrow_down, size: 16, color: Color(0xFFc4c9d2)),
          ],
        ),
      ),
    );
  }
}

// ── BackChevron ──────────────────────────────────────────────
class BackChevron extends StatelessWidget {
  final VoidCallback? onTap;
  const BackChevron({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap ?? () => Navigator.of(context).pop(),
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFeef0f3)),
          borderRadius: BorderRadius.circular(10),
          color: Colors.white,
        ),
        child: const Icon(Icons.chevron_left, size: 16, color: Color(0xFF374151)),
      ),
    );
  }
}

// ── Order products helper ───────────────────────────────────
class OrderProductsWidget extends StatelessWidget {
  final List<MapEntry<Product, int>> products;
  const OrderProductsWidget({super.key, required this.products});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: products.map((e) {
        final product = e.key;
        final qty = e.value;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              ProductIcon(name: product.name, size: 36),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(product.name, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: Color(0xFF1f2937))),
                    Text(product.sub, style: const TextStyle(fontSize: 11.5, color: Color(0xFF9ca3af))),
                  ],
                ),
              ),
              Text('× $qty', style: const TextStyle(fontSize: 11, color: Color(0xFF9ca3af))),
              const SizedBox(width: 8),
              Text(brl(product.unit * qty), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF374151))),
            ],
          ),
        );
      }).toList(),
    );
  }
}
