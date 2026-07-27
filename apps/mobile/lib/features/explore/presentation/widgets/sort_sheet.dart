import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/bottom_sheet.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class SortSheet extends StatelessWidget {
  final String kind;
  final String sort;
  final bool hasSearchQuery;
  final bool hasLocation;
  final ValueChanged<String> onApply;

  const SortSheet({
    super.key,
    required this.kind,
    required this.sort,
    this.hasSearchQuery = false,
    this.hasLocation = false,
    required this.onApply,
  });

  List<_SortOption> get _options {
    if (kind == 'clinic') {
      return [
        if (hasSearchQuery)
          _SortOption(
            'relevance',
            'Relevância',
            'Melhores resultados para a busca',
          ),
        _SortOption('name-asc', 'Nome A–Z', 'Ordem alfabética'),
        _SortOption('name-desc', 'Nome Z–A', 'Ordem alfabética inversa'),
        if (hasLocation)
          _SortOption('distance', 'Mais próximos', 'Menor distância primeiro'),
        _SortOption('purchase-funnel-asc', 'Etapa do funil', 'Ordem crescente'),
        _SortOption(
          'purchase-funnel-desc',
          'Etapa do funil — inversa',
          'Ordem decrescente',
        ),
        _SortOption(
          'purchase-interval-asc',
          'Intervalo de compras',
          'Menor intervalo primeiro',
        ),
        _SortOption(
          'purchase-interval-desc',
          'Intervalo de compras — inverso',
          'Maior intervalo primeiro',
        ),
        _SortOption(
          'last-purchase-desc',
          'Última compra',
          'Mais recente primeiro',
        ),
        _SortOption(
          'last-purchase-asc',
          'Última compra — antiga',
          'Mais antiga primeiro',
        ),
      ];
    }
    // Facility-scoped people lists (no distance / last-contact).
    if (kind == 'facility-people') {
      return [_SortOption('name-asc', 'Nome A–Z', 'Ordem alfabética')];
    }
    return [
      _SortOption('name-asc', 'Nome A–Z', 'Ordem alfabética'),
      _SortOption('distance', 'Mais próximos', 'Menor distância primeiro'),
      _SortOption(
        'last-contact',
        'Sem contato há mais tempo',
        'Retome relacionamentos',
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final selected = sort;
    return BottomSheetWidget(
      title: 'Ordenar por',
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: _options.map((opt) {
            final on = selected == opt.key;
            return Semantics(
              button: true,
              selected: on,
              label: '${opt.label}. ${opt.subtitle}',
              child: InkWell(
                onTap: () {
                  onApply(opt.key);
                  Navigator.pop(context);
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  margin: const EdgeInsets.only(bottom: 4),
                  decoration: BoxDecoration(
                    color: on ? const Color(0xFFeef2ff) : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: on
                                ? AppColors.blue50
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: on
                                        ? AppColors.navyBright
                                        : AppColors.gray300,
                                    width: 2,
                                  ),
                                  color: on
                                      ? AppColors.navyBright
                                      : Colors.white,
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              opt.label,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF0f1729),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      opt.label,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.gray900,
                                      ),
                                    ),
                                    const SizedBox(height: 1),
                                    Text(
                                      opt.subtitle,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.gray500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _SortOption {
  final String key;
  final String label;
  final String subtitle;
  const _SortOption(this.key, this.label, this.subtitle);
}
