import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Picks the clinic whose orders to show.
///
/// Searches the same clinic index Explorar does, so a clinic is found by the
/// same words here as anywhere else in the app, and returns the choice rather
/// than applying it — the list decides what to do with it.
Future<OrderFacilityFilter?> showOrderClinicFilterSheet(
  BuildContext context, {
  OrderFacilityFilter? current,
}) {
  return showModalBottomSheet<OrderFacilityFilter>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _OrderClinicFilterSheet(current: current),
  );
}

/// Sentinel for "show every clinic again", since null means "dismissed".
const clearOrderClinicFilter = OrderFacilityFilter(id: 0, name: '');

class _OrderClinicFilterSheet extends ConsumerStatefulWidget {
  const _OrderClinicFilterSheet({this.current});

  final OrderFacilityFilter? current;

  @override
  ConsumerState<_OrderClinicFilterSheet> createState() =>
      _OrderClinicFilterSheetState();
}

class _OrderClinicFilterSheetState
    extends ConsumerState<_OrderClinicFilterSheet> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final normalized = _query.trim();
    // Two characters before asking: a one-letter search is the whole database.
    final results = normalized.length < 2
        ? const AsyncValue<PaginatedFacilities>.data(
            PaginatedFacilities(
              items: [],
              pagination: Pagination(
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
              ),
            ),
          )
        : ref.watch(
            clinicsPageProvider(
              ClinicsQuery(searchQuery: normalized, limit: 20),
            ),
          );

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppColors.gray200,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const Text(
            'Pedidos de uma clínica',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Busque a clínica para ver todos os pedidos feitos a ela.',
            style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
          ),
          const SizedBox(height: 14),
          TextField(
            key: const Key('orders-clinic-search'),
            controller: _controller,
            autofocus: true,
            textInputAction: TextInputAction.search,
            onChanged: (value) => setState(() => _query = value),
            decoration: InputDecoration(
              hintText: 'Buscar clínica por nome…',
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              filled: true,
              fillColor: AppColors.surfaceTertiary,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
          if (widget.current != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                key: const Key('orders-clinic-clear'),
                onPressed: () =>
                    Navigator.of(context).pop(clearOrderClinicFilter),
                icon: const Icon(Icons.close_rounded, size: 18),
                label: Text('Mostrar todas (${widget.current!.name})'),
              ),
            ),
          ],
          const SizedBox(height: 6),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.45,
            ),
            child: normalized.length < 2
                ? const _Hint('Digite ao menos duas letras para buscar.')
                : results.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(
                        child: SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
                    ),
                    error: (_, _) =>
                        const _Hint('Não foi possível buscar clínicas.'),
                    data: (page) => page.items.isEmpty
                        ? _Hint(
                            'Nenhuma clínica encontrada para "$normalized".',
                          )
                        : ListView.separated(
                            shrinkWrap: true,
                            itemCount: page.items.length,
                            separatorBuilder: (_, _) => const Divider(
                              height: 1,
                              color: AppColors.surfaceSecondary,
                            ),
                            itemBuilder: (_, index) {
                              final facility = page.items[index];
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(
                                  facility.name,
                                  style: const TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.gray900,
                                  ),
                                ),
                                subtitle: Text(
                                  [facility.city, facility.state]
                                      .whereType<String>()
                                      .where((part) => part.isNotEmpty)
                                      .join(' · '),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.gray500,
                                  ),
                                ),
                                trailing: const Icon(
                                  Icons.chevron_right_rounded,
                                  size: 20,
                                  color: AppColors.gray400,
                                ),
                                onTap: () => Navigator.of(context).pop(
                                  OrderFacilityFilter(
                                    id: facility.id,
                                    name: facility.name,
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint(this.message);

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 20),
    child: Text(
      message,
      textAlign: TextAlign.center,
      style: const TextStyle(fontSize: 13, color: AppColors.gray400),
    ),
  );
}
