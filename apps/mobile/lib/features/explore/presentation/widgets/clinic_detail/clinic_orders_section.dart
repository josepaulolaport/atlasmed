import 'package:atlasmed_mobile_app/features/orders/data/models/order_status.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

/// "Pedidos recentes" — snapping PageView of cards, mirroring the médicos
/// card layout (icon + identity header, badge area, info rows, footer link).
class ClinicOrdersSection extends StatefulWidget {
  const ClinicOrdersSection({
    super.key,
    required this.orders,
    required this.facilityId,
    this.hasMore = false,
    this.loadingMore = false,
    this.onLoadMore,
  });

  /// The pages fetched so far, not the clinic's whole history.
  final List<FacilityOrderSummary> orders;
  final int facilityId;
  final bool hasMore;
  final bool loadingMore;

  /// Called as the rep nears the end of what has been loaded. Null leaves the
  /// carousel at whatever it was given — which is what it always did, on a
  /// clinic that can have eighty orders behind the five it showed.
  final VoidCallback? onLoadMore;

  @override
  State<ClinicOrdersSection> createState() => _ClinicOrdersSectionState();
}

class _ClinicOrdersSectionState extends State<ClinicOrdersSection> {
  final PageController _controller = PageController(viewportFraction: 0.86);

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onSwipe);
  }

  @override
  void dispose() {
    _controller.removeListener(_onSwipe);
    _controller.dispose();
    super.dispose();
  }

  /// Fetches one card early, so the next page is usually there by the time the
  /// swipe lands on it.
  void _onSwipe() {
    if (!widget.hasMore || widget.onLoadMore == null) return;
    final page = _controller.page;
    if (page == null) return;
    if (page >= widget.orders.length - 2) widget.onLoadMore!();
  }

  @override
  Widget build(BuildContext context) {
    final orders = widget.orders;

    if (orders.isEmpty) {
      return ClinicaEmptySection(
        icon: Icons.receipt_long_outlined,
        title: 'Nenhum pedido registrado',
        description: 'Os pedidos registrados aparecerão aqui.',
      );
    }

    // A trailing spinner card while the next page is in flight, so the
    // carousel does not simply stop dead at the last loaded order.
    final showSpinner = widget.loadingMore;
    final itemCount = orders.length + (showSpinner ? 1 : 0);

    return SizedBox(
      height: 239,
      child: PageView.builder(
        controller: _controller,
        itemCount: itemCount,
        itemBuilder: (_, i) {
          final last = i == itemCount - 1;
          final padding = EdgeInsets.only(
            left: i == 0 ? 20 : 6,
            right: last ? 20 : 6,
          );
          if (showSpinner && i == orders.length) {
            return Padding(
              padding: padding,
              child: const Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            );
          }
          return Padding(
            padding: padding,
            child: _OrderCard(order: orders[i], facilityId: widget.facilityId),
          );
        },
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, required this.facilityId});

  final FacilityOrderSummary order;
  final int facilityId;

  @override
  Widget build(BuildContext context) {
    final (statusLabel, statusColor, statusBg) = _style(order.status);
    final (typeLabel, typeColor, typeBg) = _typeStyle(order.type);

    return Container(
      padding: const EdgeInsets.all(14),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.receipt_long_rounded,
                  size: 19,
                  color: statusColor,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.displayId,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 5),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          _formatOrderDate(order.orderedAt),
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.gray500,
                          ),
                        ),
                        _Badge(
                          label: statusLabel,
                          color: statusColor,
                          background: statusBg,
                        ),
                        _Badge(
                          label: typeLabel,
                          color: typeColor,
                          background: typeBg,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.gray100),
          const SizedBox(height: 8),
          _OrderItemsTable(order: order),
          const Spacer(),
          const Divider(height: 1, color: AppColors.gray100),
          const SizedBox(height: 8),
          InkWell(
            onTap: () => OrderDetailRoute(id: order.id).push(context),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Ver detalhes',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.navyBright,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 16,
                    color: AppColors.navyBright,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatOrderDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  /// The same vocabulary and colours Pedidos uses. This carried its own
  /// four-case switch and fell through to the raw enum, so a clinic's history
  /// showed "NO_BILLING" and "DRAFT" — two of the six statuses — as database
  /// values, next to "Faturado" and "Pendente".
  (String, Color, Color) _style(String status) {
    final parsed = orderStatusFromJson(status);
    return (parsed.label, parsed.color, parsed.bg);
  }

  (String, Color, Color) _typeStyle(String type) {
    switch (type) {
      case 'SALE':
        return ('Venda', AppColors.gray600, AppColors.gray100);
      case 'CONSIGNMENT':
        return ('Consignação', AppColors.gray600, AppColors.gray100);
      case 'DONATION':
        return ('Doação', AppColors.gray600, AppColors.gray100);
      default:
        return ('Outro', AppColors.gray600, AppColors.gray100);
    }
  }
}

/// Small inline pill used for both the status and order-type tags next to
/// the order date.
class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.color,
    required this.background,
  });

  final String label;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

/// Compact preview of an order's line items — always at most 2 real rows so
/// the card never grows taller, name first (left) and quantity right-
/// aligned; anything beyond that collapses into a single "+N itens" row
/// instead of listing every one, followed by the subtotal.
class _OrderItemsTable extends StatelessWidget {
  const _OrderItemsTable({required this.order});

  final FacilityOrderSummary order;

  static const _maxVisibleItems = 2;

  @override
  Widget build(BuildContext context) {
    final items = order.items;
    if (items.isEmpty) {
      return const Center(
        child: Text(
          'Itens não detalhados',
          style: TextStyle(fontSize: 11, color: AppColors.gray400),
          textAlign: TextAlign.center,
        ),
      );
    }

    final visibleCount = items.length > _maxVisibleItems
        ? _maxVisibleItems
        : items.length;
    final remaining = items.length - visibleCount;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in items.take(visibleCount))
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    item.productName,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.gray600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${_formatQty(item.quantity)}x',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray500,
                  ),
                ),
              ],
            ),
          ),
        if (remaining > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(
              '+ $remaining item${remaining == 1 ? '' : 's'}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.gray400,
              ),
            ),
          ),
        const SizedBox(height: 2),
        const Divider(height: 1, color: AppColors.gray100),
        const SizedBox(height: 4),
        Row(
          children: [
            const Text(
              'Subtotal:',
              style: TextStyle(fontSize: 11, color: AppColors.gray500),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                // The same formatter Pedidos uses. This printed
                // "R$ 8000.00" — a decimal point — beside screens showing
                // "R$ 5301,00".
                formatOrderCurrency(order.itemsSubtotal),
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.right,
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _formatQty(double q) =>
      q % 1 == 0 ? q.toInt().toString() : q.toStringAsFixed(1);
}
