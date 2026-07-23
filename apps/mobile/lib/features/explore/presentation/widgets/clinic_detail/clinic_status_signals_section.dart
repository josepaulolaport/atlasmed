import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';

/// "Sinais" — concrete status signals sourced from `facilities` DB columns:
/// commercial status, purchase status ("tipo de cliente"), conformity
/// status and last purchase date. Replaces the narrative "Avisos" concept
/// from the reference design with fields that already exist in the schema.
class ClinicStatusSignalsSection extends StatelessWidget {
  const ClinicStatusSignalsSection({super.key, required this.signals});

  final FacilityStatusSignals? signals;

  @override
  Widget build(BuildContext context) {
    final s = signals;
    if (s == null) {
      return const ClinicDetailCard(
        child: Text(
          'Sinais indisponíveis para este estabelecimento',
          style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
        ),
      );
    }

    final days = s.daysSinceLastPurchase;

    return ClinicDetailCard(
      padding: const EdgeInsets.all(4),
      child: Column(
        children: [
          _SignalRow(
            label: 'Status comercial',
            value: s.commercialStatus.label,
            color: s.commercialStatus.color,
          ),
          if (s.purchaseStatus != null)
            _SignalRow(
              label: 'Tipo de cliente',
              value: s.purchaseStatus!.label,
              color: s.purchaseStatus!.color,
              detail: days != null ? 'sem pedido há $days dias' : null,
            ),
          _SignalRow(
            label: 'Conformidade',
            value: s.conformityStatus.label,
            color: s.conformityStatus.color,
          ),
          _SignalRow(
            label: 'Última compra',
            value: s.lastPurchaseAt != null
                ? _formatDate(s.lastPurchaseAt!)
                : 'Sem registro',
            color: const Color(0xFF6b7280),
            isLast: true,
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

class _SignalRow extends StatelessWidget {
  const _SignalRow({
    required this.label,
    required this.value,
    required this.color,
    this.detail,
    this.isLast = false,
  });

  final String label;
  final String value;
  final Color color;
  final String? detail;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: Color(0xFFf3f4f6))),
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
                    fontSize: 12.5,
                    color: Color(0xFF6b7280),
                  ),
                ),
                if (detail != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    detail!,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF9ca3af),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              value,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
