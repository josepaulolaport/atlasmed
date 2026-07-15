import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/orders/data/models/models.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/cart.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/legacy_orders_mock.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  void _showClinicSheet(BuildContext context, WidgetRef ref) {
    final cart = ref.read(cartProvider);
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(top: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFe5e7eb),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Selecionar clínica',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
          ),
          ...kSelectorClinics.map(
            (clinic) => ListTile(
              leading: const Icon(Icons.business, color: Color(0xFF0a2f7f)),
              title: Text(clinic.name),
              trailing: cart.clinic?.id == clinic.id
                  ? const Icon(Icons.check_circle, color: Color(0xFF0a2f7f))
                  : null,
              onTap: () {
                ref.read(cartProvider.notifier).setClinic(clinic);
                Navigator.pop(context);
              },
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  void _showDoctorSheet(BuildContext context, WidgetRef ref) {
    final cart = ref.read(cartProvider);
    final clinicId = cart.clinic?.id;
    final doctors = kSelectorDoctors
        .where((d) => d.clinicId == clinicId)
        .toList();

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(top: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFe5e7eb),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Selecionar médico',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
          ),
          if (doctors.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: 24),
              child: Text(
                'Nenhum médico disponível para esta clínica',
                style: TextStyle(color: Color(0xFF6b7280)),
              ),
            )
          else
            ...doctors.map(
              (doc) => ListTile(
                title: Text(doc.name),
                subtitle: Text(doc.specialty),
                trailing: cart.doctor?.id == doc.id
                    ? const Icon(Icons.check_circle, color: Color(0xFF0a2f7f))
                    : null,
                onTap: () {
                  ref.read(cartProvider.notifier).setDoctor(doc);
                  Navigator.pop(context);
                },
              ),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  bool _hasNegotiated(CartItem item) {
    return item.unitPrice != (item.catalogUnitPrice ?? item.unitPrice);
  }

  String _money(double value) => brl(value);

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final canConfirm = cart.clinic != null && cart.doctor != null;

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  BackChevron(onTap: () => context.pop()),
                  const SizedBox(width: 12),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'NOVO PEDIDO',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF6b7280),
                          letterSpacing: 0.8,
                        ),
                      ),
                      SizedBox(height: 3),
                      Text(
                        'Checkout',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0f172a),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 18),
              _CheckoutSteps(),
              const SizedBox(height: 18),
              const Text(
                'Para quem?',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 12),
              SelectorField(
                label: 'Clínica',
                value: cart.clinic?.name,
                placeholder: 'Selecione a clínica',
                onTap: () => _showClinicSheet(context, ref),
              ),
              const SizedBox(height: 10),
              SelectorField(
                label: 'Médico responsável',
                value: cart.doctor?.name,
                placeholder: cart.clinic == null
                    ? 'Selecione a clínica primeiro'
                    : 'Selecione o médico',
                onTap: cart.clinic == null
                    ? null
                    : () => _showDoctorSheet(context, ref),
                disabled: cart.clinic == null,
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFeef0f3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Itens do pedido',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 14),
                    ...cart.items.map((item) {
                      final lineTotal = item.unitPrice * item.qty;
                      final catalogTotal =
                          (item.catalogUnitPrice ?? item.unitPrice) * item.qty;
                      final savings = catalogTotal - lineTotal;
                      final negotiated = _hasNegotiated(item);

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ProductIcon(name: item.productName, size: 32),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.productName,
                                    style: const TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF111827),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    item.productSubtitle,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      color: Color(0xFF6b7280),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      Text(
                                        '× ${item.qty}',
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          color: Color(0xFF6b7280),
                                        ),
                                      ),
                                      const Spacer(),
                                      if (negotiated) ...[
                                        Text(
                                          _money(catalogTotal),
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            color: Color(0xFF9ca3af),
                                            decoration:
                                                TextDecoration.lineThrough,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          _money(lineTotal),
                                          style: const TextStyle(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF16a373),
                                          ),
                                        ),
                                      ] else
                                        Text(
                                          _money(lineTotal),
                                          style: const TextStyle(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF374151),
                                          ),
                                        ),
                                    ],
                                  ),
                                  if (savings > 0) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      '-${_money(savings)}',
                                      style: const TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF16a373),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Total',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF111827),
                          ),
                        ),
                        Text(
                          _money(cart.subtotal),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0a2f7f),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFEAF8F1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFc8eadb)),
                ),
                child: const Row(
                  children: [
                    Icon(
                      Icons.local_shipping_outlined,
                      size: 18,
                      color: Color(0xFF16a373),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Entrega estimada em 3–5 dias úteis',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF116a4c),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: canConfirm
                      ? () => context.push('/pedidos/novo/sucesso')
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0a2f7f),
                    disabledBackgroundColor: const Color(0xFFd1d5db),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Confirmar pedido',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              if (!canConfirm) ...[
                const SizedBox(height: 10),
                const Center(
                  child: Text(
                    'Selecione clínica e médico para continuar',
                    style: TextStyle(fontSize: 12.5, color: Color(0xFF9ca3af)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CheckoutSteps extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _StepItem(label: 'Produtos', done: true),
        _Line(),
        _StepItem(label: 'Carrinho', done: true),
        _Line(),
        _StepItem(label: 'Checkout', current: true, index: 3),
      ],
    );
  }
}

class _StepItem extends StatelessWidget {
  final String label;
  final bool done;
  final bool current;
  final int index;
  const _StepItem({
    required this.label,
    this.done = false,
    this.current = false,
    this.index = 0,
  });

  @override
  Widget build(BuildContext context) {
    final bg = done
        ? const Color(0xFF0a2f7f)
        : current
        ? const Color(0xFFEAF0FF)
        : const Color(0xFFeef0f3);
    final fg = done ? Colors.white : const Color(0xFF0a2f7f);
    return Column(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          alignment: Alignment.center,
          child: done
              ? const Icon(Icons.check, size: 16, color: Colors.white)
              : Text(
                  '$index',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: fg,
                  ),
                ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFF4b5563),
          ),
        ),
      ],
    );
  }
}

class _Line extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.only(bottom: 22),
        color: const Color(0xFFDDE3EE),
      ),
    );
  }
}
