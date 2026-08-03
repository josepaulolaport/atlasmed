import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CalendarFacilityField extends ConsumerStatefulWidget {
  const CalendarFacilityField({
    super.key,
    required this.selected,
    required this.onChanged,
    this.errorText,
  });

  final CalendarIdentity? selected;
  final ValueChanged<CalendarIdentity?> onChanged;
  final String? errorText;

  @override
  ConsumerState<CalendarFacilityField> createState() =>
      _CalendarFacilityFieldState();
}

class _CalendarFacilityFieldState extends ConsumerState<CalendarFacilityField> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _controller.text = widget.selected?.name ?? '';
  }

  @override
  void didUpdateWidget(covariant CalendarFacilityField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.selected?.id != oldWidget.selected?.id) {
      _controller.text = widget.selected?.name ?? '';
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final normalized = _query.trim();
    final results = normalized.length < 2
        ? const AsyncValue<PaginatedFacilities>.data(
            PaginatedFacilities(
              items: [],
              pagination: Pagination(
                page: 1,
                limit: 10,
                total: 0,
                totalPages: 0,
              ),
            ),
          )
        : ref.watch(
            clinicsPageProvider(
              ClinicsQuery(searchQuery: normalized, limit: 10),
            ),
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          key: const Key('calendar-facility'),
          controller: _controller,
          decoration: InputDecoration(
            labelText: 'Clínica',
            hintText: 'Buscar por nome',
            errorText: widget.errorText,
            suffixIcon: widget.selected == null
                ? const Icon(Icons.search_rounded)
                : IconButton(
                    tooltip: 'Limpar clínica',
                    onPressed: () {
                      _controller.clear();
                      setState(() => _query = '');
                      widget.onChanged(null);
                    },
                    icon: const Icon(Icons.close_rounded),
                  ),
          ),
          onChanged: (value) {
            setState(() => _query = value);
            if (widget.selected != null && value != widget.selected!.name) {
              widget.onChanged(null);
            }
          },
        ),
        if (normalized.length >= 2 && widget.selected == null)
          results.when(
            loading: () => const LinearProgressIndicator(minHeight: 2),
            error: (_, _) => const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Não foi possível buscar clínicas.'),
            ),
            data: (page) => page.items.isEmpty
                ? const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text('Nenhuma clínica encontrada.'),
                  )
                : Material(
                    color: Theme.of(context).colorScheme.surface,
                    child: Column(
                      children: page.items
                          .map(
                            (facility) => ListTile(
                              dense: true,
                              title: Text(facility.name),
                              subtitle: Text(
                                [facility.city, facility.state]
                                    .whereType<String>()
                                    .where((value) => value.isNotEmpty)
                                    .join(' · '),
                              ),
                              onTap: () {
                                final selection = CalendarIdentity(
                                  id: facility.id,
                                  name: facility.name,
                                );
                                _controller.text = facility.name;
                                setState(() => _query = '');
                                widget.onChanged(selection);
                              },
                            ),
                          )
                          .toList(growable: false),
                    ),
                  ),
          ),
      ],
    );
  }
}
