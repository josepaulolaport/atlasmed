import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// One order, built only from columns that exist.
///
/// What this screen used to show, and no longer does: a delivery ETA banner, a
/// courier tracking card, a payment-method card, an invoice number, a clinic
/// address and a doctor's CRM. None of those are stored anywhere — there is no
/// shipping, payment or invoice table in the schema. They were empty strings
/// and one synthesized timeline entry, except the payment method, which was
/// read out of the order's free-text `notes` and defaulted to "credit".
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

        return Scaffold(
          backgroundColor: AppColors.background,
          body: SafeArea(
            child: RefreshIndicator(
              onRefresh: () async =>
                  ref.invalidate(orderDetailProvider(orderId)),
              child: ListView(
                // A short order does not fill the screen, and a list that
                // cannot be over-scrolled never hands the gesture to the
                // indicator — pull-to-refresh did nothing on most orders.
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  _Header(detail: detail),
                  const SizedBox(height: 14),
                  _CardShell(child: _SummaryCard(detail: detail)),
                  const SizedBox(height: 14),
                  _CardShell(child: _ItemsCard(detail: detail)),
                  if (detail.notes != null) ...[
                    const SizedBox(height: 14),
                    _CardShell(child: _NotesCard(notes: detail.notes!)),
                  ],
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
    // The same shell as the cards under it. It was a white strip with a
    // bottom border floating inside a padded list, which read as a piece of
    // a chrome bar that had come loose.
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 14, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceSecondary),
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
                  // The Emultec number when there is one, so this matches the
                  // number the clinic and the invoice use.
                  detail.displayId,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navyDeep,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detail.placedAt,
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

/// Portuguese for the `order_type` enum. Every current row is SALE, but a
/// consignment reads very differently to a rep looking at the same total.
String orderTypeLabel(String type) {
  switch (type) {
    case 'SALE':
      return 'Venda';
    case 'CONSIGNMENT':
      return 'Consignação';
    case 'DONATION':
      return 'Doação';
    case 'OTHER':
      return 'Outro';
    default:
      return type;
  }
}

class _SummaryCard extends StatelessWidget {
  final OrderDetail detail;
  const _SummaryCard({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle('Pedido'),
          const SizedBox(height: 12),
          _DetailRow(
            label: 'Clínica',
            value: detail.clinic,
            onTap: () => ClinicDetailRoute(id: detail.facilityId).push(context),
          ),
          _DetailRow(label: 'Tipo', value: orderTypeLabel(detail.type)),
          if (detail.seller != null)
            _DetailRow(label: 'Vendedor', value: detail.seller!),
          _DetailRow(label: 'Data do pedido', value: detail.placedAt),
          if (detail.updatedAt != null)
            _DetailRow(label: 'Última atualização', value: detail.updatedAt!),
          if (detail.currency != 'BRL')
            _DetailRow(label: 'Moeda', value: detail.currency),
        ],
      ),
    );
  }
}

class _ItemsCard extends StatelessWidget {
  final OrderDetail detail;
  const _ItemsCard({required this.detail});

  @override
  Widget build(BuildContext context) {
    final count = detail.items.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardTitle('Itens ($count)'),
          const SizedBox(height: 12),
          if (detail.items.isEmpty)
            const Text(
              'Nenhum item registrado neste pedido.',
              style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
            ),
          ...detail.items.map((item) => _ItemRow(item: item)),
          const SizedBox(height: 4),
          // The sums sit on their own ground rather than running straight on
          // from the lines with a hairline between them.
          Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            decoration: BoxDecoration(
              color: AppColors.surfaceTertiary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                _TotalRow(label: 'Subtotal', value: detail.itemsTotal),
                // Shown whenever it moves the total. It is 1.00 on every
                // imported order — a placeholder rather than a real shipping
                // cost — but leaving it out is worse than naming it: the
                // screen read "Subtotal 5300 / Total 5301", arithmetic a rep
                // cannot check.
                if (detail.freight != 0) ...[
                  const SizedBox(height: 6),
                  _TotalRow(label: 'Frete', value: detail.freight),
                ],
                const SizedBox(height: 8),
                const Divider(height: 1, color: AppColors.gray200),
                const SizedBox(height: 8),
                _TotalRow(label: 'Total', value: detail.total, bold: true),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  final OrderDetailItem item;
  const _ItemRow({required this.item});

  /// `2` not `2.000`, but `1.5` survives — quantity is numeric(12,3) and a
  /// fractional line is legitimate.
  String get _quantity {
    final rounded = item.qty.roundToDouble();
    return rounded == item.qty
        ? rounded.toStringAsFixed(0)
        : item.qty.toString();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name ?? 'Produto não identificado',
                  style: const TextStyle(
                    fontSize: 13,
                    // The catalogue stores these in capitals, so most run to
                    // three lines and need the room to breathe.
                    height: 1.3,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray900,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    '$_quantity × ${formatOrderCurrency(item.unitPrice)}',
                    if (item.code != null) 'Cód. ${item.code}',
                    if (item.batchNumber != null) 'Lote ${item.batchNumber}',
                  ].join(' · '),
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.gray500,
                  ),
                ),
                if (item.writtenOff) ...[
                  const SizedBox(height: 4),
                  // Supplied without being billed — it changes what the line
                  // means, so it is stated rather than left to the total.
                  const Text(
                    'Baixado',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.amber,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            formatOrderCurrency(item.lineTotal),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.gray800,
            ),
          ),
        ],
      ),
    );
  }
}

class _NotesCard extends StatelessWidget {
  final String notes;
  const _NotesCard({required this.notes});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle('Observações'),
          const SizedBox(height: 10),
          Text(
            notes,
            style: const TextStyle(
              fontSize: 12.5,
              height: 1.4,
              color: AppColors.gray700,
            ),
          ),
        ],
      ),
    );
  }
}

class _CardTitle extends StatelessWidget {
  const _CardTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w700,
      color: AppColors.gray900,
    ),
  );
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value, this.onTap});

  final String label;
  final String value;

  /// When the value names something with a screen of its own.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 132,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.gray500,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 12.5,
              color: onTap == null ? AppColors.gray800 : AppColors.navyBright,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        if (onTap != null)
          const Icon(
            Icons.chevron_right_rounded,
            size: 18,
            color: AppColors.gray400,
          ),
      ],
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: onTap == null
          ? row
          : InkWell(
              key: const Key('order-detail-clinic'),
              onTap: onTap,
              borderRadius: BorderRadius.circular(8),
              child: row,
            ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({
    required this.label,
    required this.value,
    this.bold = false,
  });

  final String label;
  final double value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Row(
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
          formatOrderCurrency(value),
          style: TextStyle(
            fontSize: bold ? 15 : 12.5,
            color: bold ? AppColors.navyDeep : AppColors.gray700,
            fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
