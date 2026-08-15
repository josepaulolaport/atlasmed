import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Picks a clinic in a sheet of its own.
///
/// `CalendarFacilityField` renders its matches directly beneath the input,
/// which works in the full editor where there is a page to grow into. Inside a
/// bottom sheet the same list lands below the bottom of the screen: the rep
/// types, results arrive, and nothing appears to happen. A sheet gives the
/// results somewhere to be.
Future<CalendarIdentity?> showClinicPicker(BuildContext context) {
  return showModalBottomSheet<CalendarIdentity>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.cardBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (_) => const _ClinicPickerSheet(),
  );
}

class _ClinicPickerSheet extends ConsumerStatefulWidget {
  const _ClinicPickerSheet();

  @override
  ConsumerState<_ClinicPickerSheet> createState() => _ClinicPickerSheetState();
}

class _ClinicPickerSheetState extends ConsumerState<_ClinicPickerSheet> {
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
    // Two characters before asking: one letter matches most of the book and
    // the request is wasted.
    final results = normalized.length < 2
        ? null
        : ref.watch(
            clinicsPageProvider(
              ClinicsQuery(searchQuery: normalized, limit: 20),
            ),
          );

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.72,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Selecionar clínica',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray900,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, size: 20),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                key: const Key('clinic-picker-search'),
                controller: _controller,
                autofocus: true,
                onChanged: (value) => setState(() => _query = value),
                decoration: const InputDecoration(
                  hintText: 'Buscar por nome',
                  prefixIcon: Icon(Icons.search_rounded, size: 20),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: results == null
                  ? const _Hint('Digite ao menos duas letras.')
                  : results.when(
                      loading: () =>
                          const Center(child: CircularProgressIndicator()),
                      error: (_, _) =>
                          const _Hint('Não foi possível buscar clínicas.'),
                      data: (page) => page.items.isEmpty
                          ? const _Hint('Nenhuma clínica encontrada.')
                          : ListView.builder(
                              itemCount: page.items.length,
                              itemBuilder: (context, index) {
                                final facility = page.items[index];
                                return ListTile(
                                  dense: true,
                                  title: Text(facility.name),
                                  subtitle: Text(
                                    [facility.city, facility.state]
                                        .whereType<String>()
                                        .where((value) => value.isNotEmpty)
                                        .join(' · '),
                                  ),
                                  onTap: () => Navigator.of(context).pop(
                                    CalendarIdentity(
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
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 13, color: AppColors.gray500),
      ),
    ),
  );
}
