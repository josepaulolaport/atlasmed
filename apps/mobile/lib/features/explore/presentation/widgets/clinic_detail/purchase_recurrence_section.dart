import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:flutter/material.dart';

class PurchaseRecurrenceSection extends StatelessWidget {
  const PurchaseRecurrenceSection({
    super.key,
    required this.value,
    required this.onEdit,
  });

  final PurchaseRecurrenceSnapshot? value;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final recurrence = value;
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
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
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onEdit,
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Editar perfil de compras'),
            ),
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
          child: Text(label, style: const TextStyle(color: Color(0xFF6B7280))),
        ),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}
