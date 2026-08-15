import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_form_styles.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/calendar_facility_field.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/doctor_detail_providers.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The clinics a professional currently works at, named.
final professionalClinicsProvider = FutureProvider.autoDispose
    .family<List<CalendarIdentity>, int>((ref, personId) async {
      final repository = ref.watch(doctorDetailRepositoryProvider(personId));
      final detail = await repository.currentValueOrResolve();
      return (detail?.facilities ?? const [])
          .map(
            (facility) =>
                CalendarIdentity(id: facility.id, name: facility.name),
          )
          .toList(growable: false);
    });

/// Asks for the clinic in the way the entry point allows.
///
/// Opening the editor from a clinic already answers the question, and opening
/// it from a doctor narrows it to where that doctor attends — a visit to a
/// doctor at a clinic they do not work at is not a thing anyone means to book.
/// Only the agenda's own "+", which knows nothing yet, searches everything.
class CalendarFacilitySelector extends ConsumerStatefulWidget {
  const CalendarFacilitySelector({
    super.key,
    required this.choice,
    required this.selected,
    required this.onChanged,
    this.personId,
    this.errorText,
  });

  final CalendarFacilityChoice choice;
  final CalendarIdentity? selected;
  final ValueChanged<CalendarIdentity?> onChanged;
  final int? personId;
  final String? errorText;

  @override
  ConsumerState<CalendarFacilitySelector> createState() =>
      _CalendarFacilitySelectorState();
}

class _CalendarFacilitySelectorState
    extends ConsumerState<CalendarFacilitySelector> {
  @override
  Widget build(BuildContext context) {
    final personId = widget.personId;
    if (widget.choice == CalendarFacilityChoice.professionalClinics &&
        personId != null) {
      return ref
          .watch(professionalClinicsProvider(personId))
          .when(
            loading: () => const _FacilityPlaceholder(
              label: 'Clínica',
              child: Row(
                children: [
                  SizedBox.square(
                    dimension: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 10),
                  // Flexible: the label runs past 402pt otherwise.
                  Flexible(
                    child: Text(
                      'Carregando clínicas do médico…',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            // Falling back to the full search rather than blocking: the rep can
            // still book the visit, they just do the narrowing themselves.
            error: (_, _) => _AnyClinicField(
              selected: widget.selected,
              onChanged: widget.onChanged,
              errorText: widget.errorText,
              helperText: 'Não foi possível carregar as clínicas do médico.',
            ),
            data: (clinics) {
              if (clinics.isEmpty) {
                return _AnyClinicField(
                  selected: widget.selected,
                  onChanged: widget.onChanged,
                  errorText: widget.errorText,
                  helperText:
                      'Este médico não tem clínicas vinculadas. Busque a clínica da visita.',
                );
              }
              return _ProfessionalClinicDropdown(
                clinics: clinics,
                selected: widget.selected,
                onChanged: widget.onChanged,
                errorText: widget.errorText,
              );
            },
          );
    }

    if (widget.choice == CalendarFacilityChoice.fixed &&
        widget.selected != null) {
      return _FacilityPlaceholder(
        label: 'Clínica',
        helperText: 'Definida pela clínica de onde a visita foi aberta.',
        child: Row(
          children: [
            Expanded(
              child: Text(
                widget.selected!.name,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ),
            const Icon(Icons.lock_outline_rounded, size: 18),
          ],
        ),
      );
    }

    return _AnyClinicField(
      selected: widget.selected,
      onChanged: widget.onChanged,
      errorText: widget.errorText,
    );
  }
}

class _AnyClinicField extends StatelessWidget {
  const _AnyClinicField({
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
  Widget build(BuildContext context) {
    final field = CalendarFacilityField(
      selected: selected,
      onChanged: onChanged,
      errorText: errorText,
    );
    if (helperText == null) return field;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        field,
        const SizedBox(height: 6),
        Text(helperText!, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _ProfessionalClinicDropdown extends StatelessWidget {
  const _ProfessionalClinicDropdown({
    required this.clinics,
    required this.selected,
    required this.onChanged,
    this.errorText,
  });

  final List<CalendarIdentity> clinics;
  final CalendarIdentity? selected;
  final ValueChanged<CalendarIdentity?> onChanged;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    // A single clinic is still shown rather than applied silently: the rep sees
    // where the visit is going before saving, and one option is one tap.
    final current = clinics.where((c) => c.id == selected?.id).firstOrNull;
    return DropdownButtonFormField<int>(
      key: const Key('calendar-facility-professional'),
      initialValue: current?.id,
      isExpanded: true,
      borderRadius: BorderRadius.circular(12),
      decoration: appFieldDecoration(
        label: 'Clínica',
        errorText: errorText,
        helperText: 'Onde este médico atende',
      ),
      items: clinics
          .map(
            (clinic) => DropdownMenuItem(
              value: clinic.id,
              child: Text(clinic.name, overflow: TextOverflow.ellipsis),
            ),
          )
          .toList(growable: false),
      onChanged: (id) => onChanged(
        id == null ? null : clinics.firstWhere((clinic) => clinic.id == id),
      ),
    );
  }
}

class _FacilityPlaceholder extends StatelessWidget {
  const _FacilityPlaceholder({
    required this.label,
    required this.child,
    this.helperText,
  });

  final String label;
  final Widget child;
  final String? helperText;

  @override
  Widget build(BuildContext context) => InputDecorator(
    decoration: appFieldDecoration(label: label, helperText: helperText),
    // Already-settled, so it reads as a stated fact rather than an empty field
    // waiting to be filled.
    baseStyle: const TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w600,
      color: AppColors.gray900,
    ),
    child: child,
  );
}
