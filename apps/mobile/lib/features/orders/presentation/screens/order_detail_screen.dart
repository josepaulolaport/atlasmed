import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/orders/data/models/order_status.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/payment_method.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/cart.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class OrderDetailScreen extends ConsumerWidget {
  final int orderId;

  const OrderDetailScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(orderDetailProvider(orderId));

    return detailAsync.when(
      loading: () => const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: Text('Não foi possível carregar o pedido.')),
      ),
      data: (apiDetail) {
        final detail = orderDetailForApi(apiDetail);
        final resolvedItems = detail.items
            .map(
              (item) => MapEntry(
                Product(
                  id: item.productId,
                  name: item.name ?? item.productId.toString(),
                  sub: '',
                  unit: item.unitPrice ?? 0,
                  category: '',
                ),
                item.qty,
              ),
            )
            .toList(growable: false);
        final subtotal = resolvedItems.fold<double>(
          0,
          (sum, entry) => sum + (entry.key.unit * entry.value),
        );
        final total = subtotal + detail.shipping;
        final hasTracking =
            detail.status == OrderStatus.approved && detail.tracking.isNotEmpty;

        return Scaffold(
          backgroundColor: AppColors.background,
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Header(detail: detail),
                  const SizedBox(height: 14),
                  _DeliveryBanner(detail: detail),
                  const SizedBox(height: 14),
                  _CardShell(child: _TimelineCard(detail: detail)),
                  if (hasTracking) ...[
                    const SizedBox(height: 14),
                    _CardShell(child: _TrackingCard(tracking: detail.tracking)),
                  ],
                  const SizedBox(height: 14),
                  _CardShell(child: _DestinationCard(detail: detail)),
                  const SizedBox(height: 14),
                  _CardShell(child: _ItemsCard(items: resolvedItems)),
                  const SizedBox(height: 14),
                  _CardShell(
                    child: _PaymentCard(
                      detail: detail,
                      subtotal: subtotal,
                      total: total,
                    ),
                  ),
                  const SizedBox(height: 18),
                  _ActionButton(label: 'Suporte', filled: true, onTap: () {}),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  final OrderDetail detail;
  const _Header({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
      ),
      child: Row(
        children: [
          const BackChevron(),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'PEDIDO',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.1,
                    color: AppColors.gray400,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  detail.id.toString(),
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navyDeep,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '· ${detail.placedAt}',
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.gray400,
                  ),
                ),
              ],
            ),
          ),
          PStatusChip(status: detail.status),
        ],
      ),
    );
  }
}

class _CardShell extends StatelessWidget {
  final Widget child;
  const _CardShell({required this.child});
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.surfaceSecondary),
    ),
    child: child,
  );
}

class _TimelineCard extends StatelessWidget {
  final OrderDetail detail;
  const _TimelineCard({required this.detail});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Acompanhamento',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 14),
          ...detail.timeline.asMap().entries.map((entry) {
            final i = entry.key;
            final step = entry.value;
            final last = i == detail.timeline.length - 1;
            return _TimelineRow(step: step, last: last);
          }),
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  final TimelineStep step;
  final bool last;
  const _TimelineRow({required this.step, required this.last});
  @override
  Widget build(BuildContext context) {
    final circleColor = step.done
        ? AppColors.green
        : (step.current ? AppColors.navyDeep : Colors.white);
    final borderColor = step.done || step.current
        ? circleColor
        : AppColors.gray200;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 24,
            child: Column(
              children: [
                Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: circleColor,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: borderColor,
                      width: step.current ? 2 : 1.2,
                    ),
                    boxShadow: step.current
                        ? const [
                            BoxShadow(
                              color: Color(0x330a2f7f),
                              blurRadius: 10,
                              spreadRadius: 2,
                            ),
                          ]
                        : null,
                  ),
                  child: step.done
                      ? const Icon(Icons.check, size: 9, color: Colors.white)
                      : (step.current
                            ? Center(
                                child: Container(
                                  width: 5,
                                  height: 5,
                                  decoration: const BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              )
                            : null),
                ),
                if (!last)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: AppColors.surfaceSecondary,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    step.step,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    step.date,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.gray400,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TrackingCard extends StatelessWidget {
  final String tracking;
  const _TrackingCard({required this.tracking});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          _MiniIcon(
            icon: Icons.local_shipping_outlined,
            bg: const Color(0x1A0a2f7f),
            fg: AppColors.navyDeep,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'CÓDIGO DE RASTREIO',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray400,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  tracking,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    fontFamily: 'monospace',
                    color: AppColors.gray900,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () async =>
                Clipboard.setData(ClipboardData(text: tracking)),
            child: const Text('Copiar'),
          ),
        ],
      ),
    );
  }
}

class _DestinationCard extends StatelessWidget {
  final OrderDetail detail;
  const _DestinationCard({required this.detail});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _MiniIcon(
                icon: Icons.local_hospital_outlined,
                bg: const Color(0x1A1e40af),
                fg: AppColors.navyBright,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      detail.clinic,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      detail.clinicAddress,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.gray500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _AvatarInitials(name: detail.doctor),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    detail.doctor,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    detail.doctorCrm,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.gray400,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ItemsCard extends StatelessWidget {
  final List<MapEntry<Product, int>> items;
  const _ItemsCard({required this.items});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ITENS (${items.length} produtos)',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 14),
          ...items.map((entry) {
            final p = entry.key;
            final qty = entry.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  ProductIcon(name: p.name, size: 38),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.name,
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.gray800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          p.sub,
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.gray400,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    'R\$ ${p.unit.toStringAsFixed(2).replaceAll('.', ',')} · × $qty',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.gray400,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    brl(p.unit * qty),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navyDeep,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  final OrderDetail detail;
  final double subtotal;
  final double total;
  const _PaymentCard({
    required this.detail,
    required this.subtotal,
    required this.total,
  });
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Pagamento',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
              ),
              Text(
                detail.invoice,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.gray400,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _moneyRow('Método', detail.paymentMethod.label),
          const SizedBox(height: 8),
          _moneyRow('Subtotal', brl(subtotal)),
          const SizedBox(height: 8),
          _moneyRow(
            'Frete',
            detail.shipping == 0 ? 'Grátis' : brl(detail.shipping),
          ),
          const Divider(height: 24),
          _moneyRow('Total', brl(total), bold: true),
        ],
      ),
    );
  }

  Widget _moneyRow(String label, String value, {bool bold = false}) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(
        label,
        style: TextStyle(
          fontSize: 12.5,
          color: bold ? AppColors.gray900 : AppColors.gray500,
          fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
      Text(
        value,
        style: TextStyle(
          fontSize: 12.5,
          color: bold ? AppColors.navyDeep : AppColors.gray700,
          fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
    ],
  );
}

class _DeliveryBanner extends StatelessWidget {
  final OrderDetail detail;
  const _DeliveryBanner({required this.detail});
  @override
  Widget build(BuildContext context) {
    final delivered = detail.status == OrderStatus.invoiced;
    final bg = delivered ? const Color(0x1F16a373) : const Color(0x1A0a2f7f);
    final fg = delivered ? AppColors.green600 : AppColors.navyDeep;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: bg),
      ),
      child: Row(
        children: [
          Icon(Icons.schedule_outlined, size: 18, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              detail.estimate,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: fg,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniIcon extends StatelessWidget {
  final IconData icon;
  final Color bg;
  final Color fg;
  const _MiniIcon({required this.icon, required this.bg, required this.fg});
  @override
  Widget build(BuildContext context) => Container(
    width: 34,
    height: 34,
    decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
    child: Icon(icon, size: 18, color: fg),
  );
}

class _AvatarInitials extends StatelessWidget {
  final String name;
  const _AvatarInitials({required this.name});
  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(' ');
    final initials = parts.length >= 2
        ? '${parts.first[0]}${parts.last[0]}'
        : parts.first.substring(0, 1);
    return Container(
      width: 34,
      height: 34,
      decoration: const BoxDecoration(
        color: AppColors.blueLight,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initials.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.navyDeep,
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final bool filled;
  final VoidCallback onTap;
  const _ActionButton({
    required this.label,
    required this.filled,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 46,
    child: OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        backgroundColor: filled ? Colors.white : Colors.white,
        foregroundColor: filled ? AppColors.gray950 : AppColors.navyDeep,
        side: const BorderSide(color: AppColors.surfaceSecondary),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: filled ? AppColors.gray950 : AppColors.navyDeep,
        ),
      ),
    ),
  );
}
