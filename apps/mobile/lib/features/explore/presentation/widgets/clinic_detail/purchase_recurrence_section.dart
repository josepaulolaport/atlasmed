import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class PurchaseRecurrenceSection extends StatelessWidget {
  const PurchaseRecurrenceSection({
    super.key,
    required this.value,
  });

  final PurchaseRecurrenceSnapshot? value;

  @override
  Widget build(BuildContext context) {
    final recurrence = value;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (recurrence == null)
              const Text('Perfil de compras não disponível')
            else ...[
              _line(
                'Etapa',
                recurrence.funnelStage?.label ?? 'Não reconhecida',
              ),
              _line('Perfil', recurrence.profile?.label ?? 'Não informado'),
              _line('Origem', recurrence.source?.label ?? 'Não reconhecida'),
              _line('Intervalo efetivo', '${recurrence.intervalDays} dias'),
              _line(
                'Intervalo observado',
                recurrence.observedIntervalDays == null
                    ? 'Não disponível'
                    : '${recurrence.observedIntervalDays} dias',
              ),
              _line('Amostra', '${recurrence.sampleSize} intervalos'),
              _line(
                'Última compra',
                formatDateOnly(recurrence.lastPurchaseDate),
              ),
              _line(
                'Próxima transição',
                formatDateOnly(recurrence.nextTransitionDate),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _line(String label, String text) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 140,
          child: Text(label, style: const TextStyle(color: AppColors.gray500)),
        ),
        Expanded(
          child: Text(
            text,
            textAlign: TextAlign.right,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}
