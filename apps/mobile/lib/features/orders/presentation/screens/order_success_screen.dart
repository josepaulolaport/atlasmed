import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/interaction_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class OrderSuccessScreen extends ConsumerStatefulWidget {
  const OrderSuccessScreen({
    super.key,
    required this.order,
    this.interactionId,
  });

  final ApiOrderDetail order;
  final String? interactionId;

  @override
  ConsumerState<OrderSuccessScreen> createState() => _OrderSuccessScreenState();
}

class _OrderSuccessScreenState extends ConsumerState<OrderSuccessScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(cartProvider.notifier).clearCart();
      ref.invalidate(ordersPageProvider(null));
      final interactionId = widget.interactionId;
      if (interactionId != null) {
        ref.invalidate(interactionProvider(interactionId));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final destinationName = order.facility.name;
    final doctorName = order.professional?.name;
    final items = order.items;
    final total = order.total;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
                children: [
                  _HeroSection(orderId: order.displayId),
                  const SizedBox(height: 16),
                  _InfoCard(
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.blueLight,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.local_hospital_outlined,
                            color: AppColors.navyDeep,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                destinationName,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.gray800,
                                ),
                              ),
                              if (doctorName != null &&
                                  doctorName.isNotEmpty) ...[
                                const SizedBox(height: 3),
                                Text(
                                  doctorName,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.gray500,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  _InfoCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Itens do pedido',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.gray800,
                          ),
                        ),
                        const SizedBox(height: 14),
                        if (items.isEmpty)
                          const Text(
                            'Os itens não foram retornados na confirmação do pedido.',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.gray500,
                            ),
                          )
                        else
                          Column(
                            children: [
                              for (final item in items) ...[
                                _OrderItemRow(item: item),
                                if (item != items.last)
                                  const SizedBox(height: 12),
                              ],
                              const SizedBox(height: 14),
                              const Divider(
                                height: 1,
                                color: AppColors.gray200,
                              ),
                              const SizedBox(height: 14),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Total',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.gray800,
                                    ),
                                  ),
                                  Text(
                                    brl(total),
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.navyDeep,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: () => widget.interactionId == null
                      ? context.go('/orders')
                      : context.go(
                          '/agenda/interactions/${widget.interactionId}',
                        ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.navyDeep,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
                    widget.interactionId == null
                        ? 'Ver meus pedidos'
                        : 'Voltar ao atendimento',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroSection extends StatelessWidget {
  final String orderId;
  const _HeroSection({required this.orderId});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.green50, AppColors.green50],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.green50, width: 2),
            ),
            child: const Icon(
              Icons.check_rounded,
              size: 42,
              color: AppColors.green,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Pedido realizado!',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppColors.gray800,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Seu pedido foi confirmado e está sendo processado.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13.5,
              color: AppColors.gray500,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppColors.gray200),
            ),
            child: Text(
              orderId,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: AppColors.navyDeep,
                letterSpacing: 0.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final Widget child;
  const _InfoCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.gray200),
      ),
      child: child,
    );
  }
}

String _quantityLabel(double value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : value.toStringAsFixed(2).replaceAll('.', ',');

class _OrderItemRow extends StatelessWidget {
  final ApiOrderItem item;
  const _OrderItemRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final productName = item.product?.name ?? 'Produto';
    return Row(
      children: [
        ProductIcon(name: productName, size: 28),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$productName × ${_quantityLabel(item.quantity)}',
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray800,
                ),
              ),
              const SizedBox(height: 2),
              if (item.product?.code case final code?)
                Text(
                  code,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.gray500,
                  ),
                ),
            ],
          ),
        ),
        Text(
          brl(item.lineTotal),
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.gray700,
          ),
        ),
      ],
    );
  }
}
