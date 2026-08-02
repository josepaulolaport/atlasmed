import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Detail list for the Fontes Pagadoras "Outros" chart bucket.
class PayerOutrosDetailScreen extends StatelessWidget {
  const PayerOutrosDetailScreen({
    super.key,
    required this.members,
    this.facilityName,
  });

  final List<PayerShare> members;
  final String? facilityName;

  @override
  Widget build(BuildContext context) {
    final sorted = [...members]
      ..sort((a, b) => b.sharePercent.compareTo(a.sharePercent));

    return Scaffold(
      backgroundColor: AppColors.surfaceTertiary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.gray900,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: const Text(
          'Outros',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (facilityName != null && facilityName!.isNotEmpty) ...[
                  Text(
                    facilityName!,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.gray500,
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                const Text(
                  'Fontes agrupadas no gráfico. Percentuais são do '
                  'faturamento total da clínica.',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.gray500,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.surfaceSecondary),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: sorted.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (_, index) {
                final payer = sorted[index];
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.surfaceSecondary),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            Flexible(
                              child: Text(
                                payer.name,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.gray900,
                                ),
                              ),
                            ),
                            if (payer.isPackage) ...[
                              const SizedBox(width: 8),
                              const _PacoteBadge(),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        '${payer.sharePercent.toStringAsFixed(0)}%',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gray700,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _PacoteBadge extends StatelessWidget {
  const _PacoteBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.navyBright.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Text(
        'Pacote',
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: AppColors.navyBright,
        ),
      ),
    );
  }
}
