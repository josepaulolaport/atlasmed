import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order_status.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/product.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

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
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: s.color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            s.label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: s.color,
              letterSpacing: 0.3,
            ),
          ),
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
    'top': {
      'bg': Color(0x1F16a373),
      'color': AppColors.green600,
      'label': 'Top',
    },
    'novo': {
      'bg': Color(0x1A1e40af),
      'color': AppColors.navyBright,
      'label': 'Novo',
    },
    'premium': {
      'bg': Color(0x1Fc6861b),
      'color': AppColors.amber,
      'label': 'Premium',
    },
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
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: s['color'] as Color,
          letterSpacing: 0.4,
        ),
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
      if (name.startsWith(key)) {
        hue = h;
        break;
      }
    }
    final hsl = HSLColor.fromAHSL(1, hue, 0.52, 0.93);
    final borderHsl = HSLColor.fromAHSL(1, hue, 0.38, 0.84);
    final textHsl = HSLColor.fromAHSL(1, hue, 0.52, 0.35);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: hsl.toColor(),
        borderRadius: BorderRadius.circular(size / 4),
        border: Border.all(color: borderHsl.toColor()),
      ),
      alignment: Alignment.center,
      child: Text(
        name.substring(0, 2),
        style: TextStyle(
          fontSize: size * 0.3,
          fontWeight: FontWeight.w700,
          color: textHsl.toColor(),
          letterSpacing: -0.5,
        ),
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
        border: Border.all(color: AppColors.surfaceSecondary),
        borderRadius: BorderRadius.circular(10),
        color: AppColors.background,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _btn(
            '-',
            () => onChange(value - 1),
            value > 0 ? AppColors.navyDeep : AppColors.gray300,
          ),
          SizedBox(
            width: 28,
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.gray800,
              ),
            ),
          ),
          _btn('+', () => onChange(value + 1), AppColors.navyDeep),
        ],
      ),
    );
  }

  Widget _btn(String label, VoidCallback onTap, Color color) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(fontSize: 18, color: color, height: 1),
        ),
      ),
    );
  }
}

// ── CartBadge ────────────────────────────────────────────────
class CartBadge extends StatelessWidget {
  final int totalQty;
  final double totalValue;
  final VoidCallback? onTap;
  const CartBadge({
    super.key,
    required this.totalQty,
    required this.totalValue,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final active = totalQty > 0;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: active
            ? const EdgeInsets.symmetric(horizontal: 12, vertical: 6)
            : const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.navyDeep : Colors.transparent,
          border: Border.all(
            color: active ? AppColors.navyDeep : AppColors.surfaceSecondary,
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  Icons.shopping_bag_outlined,
                  size: 18,
                  color: active ? Colors.white : AppColors.gray400,
                ),
                if (active)
                  Positioned(
                    top: -7,
                    right: -7,
                    child: Container(
                      width: 16,
                      height: 16,
                      decoration: const BoxDecoration(
                        color: AppColors.green,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          '$totalQty',
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            if (active) ...[
              const SizedBox(width: 7),
              Text(
                brl(totalValue),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
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
  const SelectorField({
    super.key,
    required this.label,
    this.value,
    required this.placeholder,
    this.onTap,
    this.disabled = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: disabled ? null : onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: disabled ? AppColors.background : Colors.white,
          border: Border.all(color: AppColors.surfaceSecondary),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.gray400,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    value ?? placeholder,
                    style: TextStyle(
                      fontSize: 14,
                      color: value != null
                          ? AppColors.gray800
                          : AppColors.gray300,
                      fontWeight: value != null
                          ? FontWeight.w500
                          : FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.keyboard_arrow_down,
              size: 16,
              color: AppColors.gray300,
            ),
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
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.surfaceSecondary),
          borderRadius: BorderRadius.circular(10),
          color: Colors.white,
        ),
        child: const Icon(
          Icons.chevron_left,
          size: 16,
          color: AppColors.gray700,
        ),
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
                    Text(
                      product.name,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray800,
                      ),
                    ),
                    Text(
                      product.sub,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray400,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '× $qty',
                style: const TextStyle(fontSize: 11, color: AppColors.gray400),
              ),
              const SizedBox(width: 8),
              Text(
                brl(product.unit * qty),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray700,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
