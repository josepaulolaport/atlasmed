import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_form_styles.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Doctors matching what the rep has typed, for the editor's own picker.
///
/// Deliberately not `doctorsPageProvider`: that one is Explorar's, keeps a page
/// alive against the session cache tag and carries the filters of a screen the
/// rep is not on. This is one search, disposed with the field.
final calendarPersonSearchProvider = FutureProvider.autoDispose
    .family<List<CalendarIdentity>, String>((ref, query) async {
      final repository = DoctorsRepository(searchQuery: query, limit: 10);
      ref.onDispose(repository.dispose);
      final page = await repository.currentValueOrResolve();
      return (page?.items ?? const [])
          .map(
            (doctor) => CalendarIdentity(
              id: doctor.id,
              name:
                  doctor.fullName?.trim().isNotEmpty == true
                  ? doctor.fullName!.trim()
                  : '${doctor.firstName} ${doctor.lastName}'.trim(),
            ),
          )
          .toList(growable: false);
    });

/// Who the contact is with, when it is with a person rather than a place.
///
/// §15.7.5 — a rep talks to a doctor without a clinic visit behind it: a call,
/// a corridor conversation, a coffee. The platform never suggests those, and
/// until now had nowhere to put them.
class CalendarPersonField extends ConsumerStatefulWidget {
  const CalendarPersonField({
    super.key,
    required this.selected,
    required this.onChanged,
    this.errorText,
    this.helperText,
  });

  final CalendarIdentity? selected;
  final ValueChanged<CalendarIdentity?> onChanged;
  final String? errorText;
  final String? helperText;

  @override
  ConsumerState<CalendarPersonField> createState() =>
      _CalendarPersonFieldState();
}

class _CalendarPersonFieldState extends ConsumerState<CalendarPersonField> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _controller.text = widget.selected?.name ?? '';
  }

  @override
  void didUpdateWidget(covariant CalendarPersonField oldWidget) {
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
    // Two characters, like the clinic field: one letter matches most of the
    // book and costs a request per keystroke to say so.
    final searching = normalized.length >= 2 && widget.selected == null;
    final results = searching
        ? ref.watch(calendarPersonSearchProvider(normalized))
        : const AsyncValue<List<CalendarIdentity>>.data([]);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          key: const Key('calendar-person'),
          controller: _controller,
          decoration: appFieldDecoration(
            label: 'Médico (opcional)',
            hint: 'Buscar por nome',
            errorText: widget.errorText,
            helperText: widget.helperText,
            suffixIcon: widget.selected == null
                ? const Icon(
                    Icons.search_rounded,
                    size: 20,
                    color: AppColors.gray400,
                  )
                : IconButton(
                    tooltip: 'Limpar médico',
                    onPressed: () {
                      _controller.clear();
                      setState(() => _query = '');
                      widget.onChanged(null);
                    },
                    icon: const Icon(Icons.close_rounded, size: 18),
                  ),
          ),
          onChanged: (value) {
            setState(() => _query = value);
            // Typing over a chosen doctor un-chooses them: the field would
            // otherwise show one name and mean another.
            if (widget.selected != null && value != widget.selected!.name) {
              widget.onChanged(null);
            }
          },
        ),
        if (searching)
          results.when(
            loading: () => const LinearProgressIndicator(minHeight: 2),
            error: (_, _) => const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Não foi possível buscar médicos.'),
            ),
            data: (doctors) => doctors.isEmpty
                ? const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text('Nenhum médico encontrado.'),
                  )
                : Material(
                    color: Theme.of(context).colorScheme.surface,
                    child: Column(
                      children: doctors
                          .map(
                            (doctor) => ListTile(
                              dense: true,
                              title: Text(doctor.name),
                              onTap: () {
                                _controller.text = doctor.name;
                                setState(() => _query = '');
                                widget.onChanged(doctor);
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
