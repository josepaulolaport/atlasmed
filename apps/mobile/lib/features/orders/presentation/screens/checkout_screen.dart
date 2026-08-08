import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/cart.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/selectable.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class CheckoutSubmissionController {
  CheckoutSubmissionController({String Function()? idempotencyKeyFactory})
    : _idempotencyKeyFactory =
          idempotencyKeyFactory ??
          (() => 'order-${DateTime.now().microsecondsSinceEpoch}');

  final String Function() _idempotencyKeyFactory;
  String? _pendingIdempotencyKey;
  ApiOrderDetail? _confirmationOrder;

  String get idempotencyKey =>
      _pendingIdempotencyKey ??= _idempotencyKeyFactory();

  ApiOrderDetail? get confirmationOrder => _confirmationOrder;

  void recordFailure() {}

  void recordCreatedOrder(ApiOrderDetail order) {
    _confirmationOrder = order;
    recordSuccess();
  }

  void recordSuccess() {
    _pendingIdempotencyKey = null;
  }
}

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  bool _submitting = false;
  String? _submitError;
  final CheckoutSubmissionController _submission =
      CheckoutSubmissionController();

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
              color: AppColors.gray200,
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
          // TODO: fetch real clinic list via FacilitiesRepository
          ...<SelectableClinic>[].map(
            (clinic) => ListTile(
              leading: const Icon(Icons.business, color: AppColors.navyDeep),
              title: Text(clinic.name),
              trailing: cart.clinic?.id == clinic.id
                  ? const Icon(Icons.check_circle, color: AppColors.navyDeep)
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
    // TODO: fetch real doctor list via healthcare-professionals API filtered by clinicId
    final doctors = <SelectableDoctor>[];

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
              color: AppColors.gray200,
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
                style: TextStyle(color: AppColors.gray500),
              ),
            )
          else
            ...doctors.map(
              (doc) => ListTile(
                title: Text(doc.name),
                subtitle: Text(doc.specialty),
                trailing: cart.doctor?.id == doc.id
                    ? const Icon(Icons.check_circle, color: AppColors.navyDeep)
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
    final canConfirm =
        cart.clinic != null &&
        cart.items.isNotEmpty &&
        (cart.interactionId != null || cart.doctor != null);

    return Scaffold(
      backgroundColor: AppColors.background,
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
                          color: AppColors.gray500,
                          letterSpacing: 0.8,
                        ),
                      ),
                      SizedBox(height: 3),
                      Text(
                        'Checkout',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: AppColors.gray900,
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
                  color: AppColors.gray950,
                ),
              ),
              const SizedBox(height: 12),
              SelectorField(
                label: 'Clínica',
                value: cart.clinic?.name,
                placeholder: 'Selecione a clínica',
                onTap: cart.isClinicLocked
                    ? null
                    : () => _showClinicSheet(context, ref),
                disabled: cart.isClinicLocked,
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
                  border: Border.all(color: AppColors.surfaceSecondary),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Itens do pedido',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray950,
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
                                      color: AppColors.gray950,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    item.productSubtitle,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      color: AppColors.gray500,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      Text(
                                        '× ${item.qty}',
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          color: AppColors.gray500,
                                        ),
                                      ),
                                      const Spacer(),
                                      if (negotiated) ...[
                                        Text(
                                          _money(catalogTotal),
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            color: AppColors.gray400,
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
                                            color: AppColors.green,
                                          ),
                                        ),
                                      ] else
                                        Text(
                                          _money(lineTotal),
                                          style: const TextStyle(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.gray700,
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
                                        color: AppColors.green,
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
                            color: AppColors.gray950,
                          ),
                        ),
                        Text(
                          _money(cart.subtotal),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.navyDeep,
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
                  color: AppColors.green50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.green50),
                ),
                child: const Row(
                  children: [
                    Icon(
                      Icons.local_shipping_outlined,
                      size: 18,
                      color: AppColors.green,
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Entrega estimada em 3–5 dias úteis',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.green600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              if (_submitError != null) ...[
                Text(
                  _submitError!,
                  style: const TextStyle(color: AppColors.redDark),
                ),
                const SizedBox(height: 10),
              ],
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: canConfirm && !_submitting
                      ? () => _submit(cart)
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.navyDeep,
                    disabledBackgroundColor: AppColors.gray300,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
                    _submitting ? 'Enviando pedido…' : 'Confirmar pedido',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              if (!canConfirm) ...[
                const SizedBox(height: 10),
                Center(
                  child: Text(
                    cart.interactionId != null
                        ? 'Adicione ao menos um produto para continuar'
                        : 'Selecione clínica e médico para continuar',
                    style: TextStyle(fontSize: 12.5, color: AppColors.gray400),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit(CartState cart) async {
    final clinic = cart.clinic;
    if (clinic == null || cart.items.isEmpty) return;
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      final idempotencyKey = _submission.idempotencyKey;
      final order = await ref
          .read(ordersRepositoryProvider)
          .createOrder(
            facilityId: clinic.id,
            idempotencyKey: idempotencyKey,
            interactionId: cart.interactionId,
            personId: cart.doctor?.id,
            items: cart.items
                .map(
                  (item) => CreateOrderItemInput(
                    productId: item.productId,
                    quantity: item.qty.toDouble(),
                    unitPrice: item.unitPrice,
                  ),
                )
                .toList(growable: false),
          );
      _submission.recordCreatedOrder(order);
      if (!mounted) return;
      context.push(
        Uri(
          path: '/orders/new/success',
          queryParameters: {
            'orderId': order.id,
            if (cart.interactionId != null)
              'interactionId': cart.interactionId!,
          },
        ).toString(),
        extra: order,
      );
    } catch (_) {
      if (mounted) {
        setState(
          () => _submitError =
              'Não foi possível criar o pedido. Revise sua conexão e tente novamente.',
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
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
        ? AppColors.navyDeep
        : current
        ? AppColors.blueLight
        : AppColors.surfaceSecondary;
    final fg = done ? Colors.white : AppColors.navyDeep;
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
            color: AppColors.gray600,
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
        color: AppColors.gray200,
      ),
    );
  }
}
