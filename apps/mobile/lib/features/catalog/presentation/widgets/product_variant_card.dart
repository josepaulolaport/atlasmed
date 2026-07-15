import 'package:flutter/material.dart';

import '../../../../shared/utils/formatters.dart';
import '../../data/catalog_models.dart';

/// A single product variant presentation: image, regulatory codes and price.
class ProductVariantCard extends StatelessWidget {
  final ProductVariant variant;
  const ProductVariantCard({super.key, required this.variant});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFf8f9fb),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFedeff3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  variant.name,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0f1729),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFe6f7f0),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  formatBrl(variant.price),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0f7a52),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFedeff3)),
                ),
                child: const Icon(
                  Icons.vaccines_outlined,
                  size: 30,
                  color: Color(0xFF9ca3af),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  children: [
                    ProductCodeChip(label: 'SIMPRO', value: variant.simproCode),
                    const SizedBox(height: 6),
                    ProductCodeChip(
                      label: 'BRASÍNDICE',
                      value: variant.brasindiceCode,
                    ),
                    const SizedBox(height: 6),
                    ProductCodeChip(label: 'TISS', value: variant.tissCode),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ProductCodeChip extends StatelessWidget {
  final String label;
  final String value;
  const ProductCodeChip({super.key, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 80,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFF6b7280),
              letterSpacing: 0.2,
            ),
          ),
        ),
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFFeef4ff),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFdbe6ff)),
            ),
            child: Text(
              value,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1e40af),
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Compact publication-dates row (Brasíndice + Simpro).
class ProductPublicationRow extends StatelessWidget {
  final ProductFamily family;
  const ProductPublicationRow({super.key, required this.family});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _pill(
            'BRASÍNDICE',
            formatDateBr(family.brasindicePublishedAt),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _pill('SIMPRO', formatDateBr(family.simproPublishedAt)),
        ),
      ],
    );
  }

  Widget _pill(String label, String date) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFf8f9fb),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFedeff3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: Color(0xFF8a94a6),
              letterSpacing: 0.3,
            ),
          ),
          Text(
            date,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0f1729),
            ),
          ),
        ],
      ),
    );
  }
}
