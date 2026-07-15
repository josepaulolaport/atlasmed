import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/orders/data/repositories/legacy_orders_mock.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/models.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/cart.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/tracking.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';

class OrderTrackingScreen extends ConsumerStatefulWidget {
  final String orderId;
  final String? orderStatus;

  const OrderTrackingScreen({
    super.key,
    required this.orderId,
    this.orderStatus,
  });

  @override
  ConsumerState<OrderTrackingScreen> createState() =>
      _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends ConsumerState<OrderTrackingScreen>
    with SingleTickerProviderStateMixin {
  static const _monthsShort = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];

  late final AnimationController _refreshController;
  bool _refreshing = false;
  bool _showCancelDialog = false;

  @override
  void initState() {
    super.initState();
    _refreshController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
  }

  @override
  void dispose() {
    _refreshController.dispose();
    super.dispose();
  }

  TrackingStatus _parseStatus(String? value, TrackingStatus fallback) {
    if (value == null) return fallback;
    for (final s in TrackingStatus.values) {
      if (s.name == value || s.label.toLowerCase() == value.toLowerCase()) {
        return s;
      }
    }
    return fallback;
  }

  String _fmtTimestamp(String ts) {
    final dt = DateTime.tryParse(ts);
    if (dt == null) return ts;
    return '${dt.day.toString().padLeft(2, '0')}/${_monthsShort[dt.month - 1]} · ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  TrackingOrderDetail get _order {
    return kTrackingOrders[widget.orderId] ?? kTrackingOrders['ORD-2841']!;
  }

  Future<void> _refresh() async {
    if (_refreshing) return;
    setState(() => _refreshing = true);
    await _refreshController.forward(from: 0);
    await Future<void>.delayed(const Duration(seconds: 1));
    if (!mounted) return;
    setState(() => _refreshing = false);
  }

  Future<void> _showCancel() async {
    if (_showCancelDialog) return;
    setState(() => _showCancelDialog = true);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        titlePadding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
        contentPadding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
        actionsPadding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: Color(0x1Fb84545),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.warning_rounded,
                color: Color(0xFFb84545),
              ),
            ),
            const SizedBox(height: 14),
            const Text('Cancelar pedido?', textAlign: TextAlign.center),
          ],
        ),
        content: const Text(
          'Essa ação não pode ser desfeita. O pedido será cancelado e o processo de entrega interrompido.',
          textAlign: TextAlign.center,
        ),
        actions: [
          TextButton(
            onPressed: () => context.pop(false),
            child: const Text('Voltar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFb84545),
              foregroundColor: Colors.white,
            ),
            onPressed: () => context.pop(true),
            child: const Text('Cancelar'),
          ),
        ],
      ),
    );
    if (mounted) setState(() => _showCancelDialog = false);
    if (confirmed == true && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Pedido cancelado.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    final status = _parseStatus(widget.orderStatus, order.status);
    final canCancel = ![
      TrackingStatus.shipped,
      TrackingStatus.delivered,
      TrackingStatus.cancelled,
    ].contains(status);
    final steps = const ['confirmed', 'processing', 'shipped', 'delivered'];
    final stepMeta = <String, ({String label, TrackingStatus status})>{
      'confirmed': (label: 'Confirmado', status: TrackingStatus.confirmed),
      'processing': (label: 'Em preparação', status: TrackingStatus.processing),
      'shipped': (label: 'Saiu para entrega', status: TrackingStatus.shipped),
      'delivered': (label: 'Entregue', status: TrackingStatus.delivered),
    };
    final currentIndex = steps.indexWhere((s) => stepMeta[s]!.status == status);
    final statusColor = status.color;
    final gradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [statusColor, Color.lerp(statusColor, Colors.black, 0.18)!],
    );

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Color(0xFFeef0f3))),
              ),
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
              child: Row(
                children: [
                  const BackChevron(),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ACOMPANHAR PEDIDO',
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                            color: Color(0xFF8a94a6),
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          '#ORD-2841',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0f1729),
                          ),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: _refresh,
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFFeef0f3)),
                        borderRadius: BorderRadius.circular(12),
                        color: Colors.white,
                      ),
                      child: AnimatedBuilder(
                        animation: _refreshController,
                        builder: (context, child) => Transform.rotate(
                          angle: _refreshing
                              ? _refreshController.value * 2 * math.pi
                              : 0,
                          child: child,
                        ),
                        child: const Icon(
                          Icons.refresh_rounded,
                          size: 18,
                          color: Color(0xFF0a2f7f),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: gradient,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x120f1729),
                          blurRadius: 16,
                          offset: Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 50,
                              height: 50,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.18),
                                shape: BoxShape.circle,
                              ),
                              child: Center(
                                child: Text(
                                  status.icon,
                                  style: const TextStyle(fontSize: 24),
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'STATUS ATUAL',
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white.withValues(
                                        alpha: 0.78,
                                      ),
                                      letterSpacing: 0.7,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    status.label,
                                    style: const TextStyle(
                                      fontSize: 19,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.16),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.12),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.calendar_month_rounded,
                                size: 16,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Entrega estimada: ${order.estimatedDelivery}',
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  _SectionCard(
                    title: 'Linha do tempo',
                    child: Column(
                      children: List.generate(steps.length, (i) {
                        final key = steps[i];
                        final meta = stepMeta[key]!;
                        final event = i < order.timeline.length
                            ? order.timeline[i]
                            : null;
                        final isDone = i < order.timeline.length;
                        final isCurrent =
                            meta.status == status ||
                            (currentIndex == -1 &&
                                i == order.timeline.length - 1);
                        return _TimelineRow(
                          isFirst: i == 0,
                          isLast: i == steps.length - 1,
                          isDone: isDone,
                          isCurrent: isCurrent,
                          color: statusColor,
                          label: meta.label,
                          timestamp: event != null
                              ? _fmtTimestamp(event.timestamp)
                              : 'Aguardando',
                          description:
                              event?.description ??
                              'Aguardando atualização do status.',
                          stepNumber: i + 1,
                        );
                      }),
                    ),
                  ),
                  if (order.driver != null) ...[
                    const SizedBox(height: 14),
                    _SectionCard(
                      title: 'ENTREGA · EM ROTA',
                      child: _DriverCard(driver: order.driver!),
                    ),
                  ],
                  const SizedBox(height: 14),
                  _SectionCard(
                    title: 'PRODUTOS (${order.items.length} itens)',
                    child: Column(
                      children: [
                        for (final item in order.items) ...[
                          _ProductRow(item: item),
                          const SizedBox(height: 12),
                        ],
                        Container(
                          height: 1,
                          margin: const EdgeInsets.symmetric(vertical: 6),
                          decoration: const BoxDecoration(
                            border: Border(
                              top: BorderSide(
                                color: Color(0xFFd8dde5),
                                width: 1,
                                style: BorderStyle.solid,
                              ),
                            ),
                          ),
                        ),
                        _infoLine('Total', order.total, strong: true),
                        const SizedBox(height: 4),
                        _infoLine('Pagamento', order.paymentMethod),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  _SectionCard(
                    title: 'ENDEREÇO DE ENTREGA',
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: const Color(0xFFeef2ff),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          alignment: Alignment.center,
                          child: const Text(
                            '🏥',
                            style: TextStyle(fontSize: 18),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                order.clinic.name,
                                style: const TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0f1729),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                order.clinic.address,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: Color(0xFF5b6474),
                                  height: 1.35,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      if (canCancel)
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _showCancel,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFb84545),
                              side: const BorderSide(color: Color(0xFFe9b7b7)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: const Text('Cancelar pedido'),
                          ),
                        ),
                      if (canCancel) const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: () => context.go('/splash'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF0a2f7f),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: const Text('Suporte'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoLine(String label, String value, {bool strong = false}) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              color: const Color(0xFF6b7280),
              fontWeight: strong ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 12.5,
            color: const Color(0xFF0f1729),
            fontWeight: strong ? FontWeight.w700 : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;

  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0a0f1729),
            blurRadius: 14,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0f1729),
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  final bool isFirst;
  final bool isLast;
  final bool isDone;
  final bool isCurrent;
  final Color color;
  final String label;
  final String timestamp;
  final String description;
  final int stepNumber;

  const _TimelineRow({
    required this.isFirst,
    required this.isLast,
    required this.isDone,
    required this.isCurrent,
    required this.color,
    required this.label,
    required this.timestamp,
    required this.description,
    required this.stepNumber,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 28,
          child: Column(
            children: [
              SizedBox(height: isFirst ? 12 : 0),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: isDone ? color : Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isDone ? color : const Color(0xFFd7dce3),
                    width: 1.2,
                  ),
                  boxShadow: isCurrent
                      ? [
                          BoxShadow(
                            color: color.withValues(alpha: 0.25),
                            blurRadius: 10,
                            spreadRadius: 1,
                          ),
                        ]
                      : const [],
                ),
                child: Center(
                  child: isDone
                      ? const Icon(
                          Icons.check_rounded,
                          size: 16,
                          color: Colors.white,
                        )
                      : Text(
                          '$stepNumber',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF667085),
                          ),
                        ),
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    decoration: BoxDecoration(
                      color: isDone
                          ? color.withValues(alpha: 0.25)
                          : const Color(0xFFe5e7eb),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0f1729),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  timestamp,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF8a94a6),
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF5b6474),
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _DriverCard extends StatelessWidget {
  final DriverInfo driver;
  const _DriverCard({required this.driver});

  String _initials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isEmpty ? 'D' : name[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [Color(0xFF0a2f7f), Color(0xFF1e40af)],
                ),
              ),
              child: Center(
                child: Text(
                  _initials(driver.name),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    driver.name,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${driver.vehicle} · ⭐ ${driver.rating.toStringAsFixed(1)}',
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: Color(0xFF5b6474),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFFeef2ff),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                'ETA ${driver.eta}',
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1e40af),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () {},
                child: const Text('Mensagem'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                onPressed: () {},
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0a2f7f),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Ligar'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ProductRow extends StatelessWidget {
  final TrackingOrderItem item;
  const _ProductRow({required this.item});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFFeef2ff),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Text('💊', style: TextStyle(fontSize: 18)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.productName,
                style: const TextStyle(
                  fontSize: 13.8,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0f1729),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${item.code} · ${item.quantity} ${item.unit}',
                style: const TextStyle(
                  fontSize: 11.8,
                  color: Color(0xFF6b7280),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Text(
          item.subtotal,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0f1729),
          ),
        ),
      ],
    );
  }
}
