import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/utils/formatters.dart';
import '../../../../shared/widgets/app_shell.dart';
import '../../data/catalog_models.dart';
import '../providers/catalog_provider.dart';

/// Brasíndice/Simpro price comparison table grouped by product family, with
/// ICMS 17% / 18% / 20% columns. Works both as a navbar item (drawer) and as a
/// pushed screen (back button).
class PriceTableScreen extends ConsumerWidget {
  const PriceTableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tableAsync = ref.watch(priceTableProvider);
    final canPop = context.canPop();

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Column(
          children: [
            AtlasTopBar(
              page: 'Tabela de preços',
              onBack: canPop ? () => context.pop() : null,
            ),
            Expanded(
              child: tableAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (err, _) => Center(
                  child: Text(
                    err.toString(),
                    style: const TextStyle(color: Color(0xFF6b7280)),
                  ),
                ),
                data: (groups) => ListView(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                  children: [
                    const _Heading(),
                    const SizedBox(height: 12),
                    const _IcmsLegend(),
                    const SizedBox(height: 12),
                    ...groups.map((g) => _PriceGroup(group: g)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading();

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xFFeef4ff),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(
            Icons.table_chart_outlined,
            color: Color(0xFF1e40af),
            size: 22,
          ),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tabela Brasíndice/Simpro',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0f1729),
                  letterSpacing: -0.2,
                ),
              ),
              SizedBox(height: 2),
              Text(
                'Comparativo de preços por família e alíquota de ICMS',
                style: TextStyle(fontSize: 12.5, color: Color(0xFF6b7280)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _IcmsLegend extends StatelessWidget {
  const _IcmsLegend();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: const [
        Text(
          'ICMS',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Color(0xFF6b7280),
          ),
        ),
        SizedBox(width: 10),
        _IcmsTag(label: '17%'),
        SizedBox(width: 6),
        _IcmsTag(label: '18%'),
        SizedBox(width: 6),
        _IcmsTag(label: '20%'),
      ],
    );
  }
}

class _IcmsTag extends StatelessWidget {
  final String label;
  const _IcmsTag({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 58,
      padding: const EdgeInsets.symmetric(vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFeef4ff),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: Color(0xFF1e40af),
        ),
      ),
    );
  }
}

class _PriceGroup extends StatelessWidget {
  final PriceTableGroup group;
  const _PriceGroup({required this.group});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            group.familyName,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1e40af),
            ),
          ),
          const SizedBox(height: 8),
          ...group.rows.map((r) => _PriceRow(row: r)),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Adicionar produto — em breve'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
              icon: const Icon(Icons.add_rounded, size: 16),
              label: const Text('Adicionar produto'),
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF1e40af),
                textStyle: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  final PriceTableRow row;
  const _PriceRow({required this.row});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: row.isOwn ? const Color(0xFFeef4ff) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: row.isOwn ? const Color(0xFFbfdbfe) : const Color(0xFFeef0f3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  row.productName,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: row.isOwn ? FontWeight.w800 : FontWeight.w600,
                    color: const Color(0xFF0f1729),
                  ),
                ),
              ),
              if (row.tags.isNotEmpty)
                Wrap(
                  spacing: 4,
                  children: row.tags
                      .map((t) => _MiniTag(label: t))
                      .toList(growable: false),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Última atualização: ${formatDateBr(row.updatedAt)}',
                  style: const TextStyle(
                    fontSize: 10.5,
                    color: Color(0xFF9ca3af),
                  ),
                ),
              ),
              _PriceBox(value: row.price17),
              const SizedBox(width: 6),
              _PriceBox(value: row.price18),
              const SizedBox(width: 6),
              _PriceBox(value: row.price20),
            ],
          ),
        ],
      ),
    );
  }
}

class _PriceBox extends StatelessWidget {
  final double value;
  const _PriceBox({required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 58,
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFf8f9fb),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0xFFe5e7eb)),
      ),
      child: Text(
        formatBrl(value).replaceAll('R\$ ', ''),
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: Color(0xFF0f1729),
        ),
      ),
    );
  }
}

class _MiniTag extends StatelessWidget {
  final String label;
  const _MiniTag({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFf3f4f6),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 8.5,
          fontWeight: FontWeight.w700,
          color: Color(0xFF6b7280),
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
