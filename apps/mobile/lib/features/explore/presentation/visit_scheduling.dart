import 'package:atlasmed_mobile_app/features/explore/data/domain/professional.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Opens the agenda's interaction editor with the clinic already filled in.
///
/// A visit *is* an agenda interaction, so scheduling one reuses
/// `CalendarEditorScreen` rather than growing a second form: the rep picks a
/// date, time, duration and modality in the one place those fields already
/// exist, and the appointment lands in their agenda.
void openVisitScheduler(
  BuildContext context, {
  int? facilityId,
  String? facilityName,
  String? title,
}) {
  AgendaNewRoute(
    facilityId: facilityId,
    facilityName: facilityName,
    title: title ?? (facilityName == null ? null : 'Visita · $facilityName'),
  ).push(context);
}

/// Asks which clinic the visit happens at, then opens the scheduler for it.
///
/// A doctor attends at several clinics, and the appointment belongs to one of
/// them — the agenda stores a facility, not a person. Guessing the main clinic
/// would silently book the wrong address, so the choice is always explicit,
/// even when there is only one candidate.
///
/// The listed clinics are the ones in the viewer's own territory, so the list
/// is empty for anyone holding no territory — an admin, most often. That is not
/// a dead end: the editor opens with the clinic field blank and its own search,
/// which asks the same question against every clinic.
Future<void> scheduleVisitWithDoctor(
  BuildContext context, {
  required String doctorName,
  required List<ProfessionalClinic> clinics,
}) async {
  if (clinics.isEmpty) {
    openVisitScheduler(context, title: 'Visita · $doctorName');
    return;
  }

  final chosen = await showVisitClinicChooser(
    context,
    doctorName: doctorName,
    clinics: clinics,
  );

  if (chosen == null || !context.mounted) return;
  openVisitScheduler(context, facilityId: chosen.id, facilityName: chosen.name);
}

/// The clinic question on its own, separate from the navigation that follows,
/// so the choice can be exercised without standing up the router.
Future<ProfessionalClinic?> showVisitClinicChooser(
  BuildContext context, {
  required String doctorName,
  required List<ProfessionalClinic> clinics,
}) async {
  if (clinics.isEmpty) return null;

  return showModalBottomSheet<ProfessionalClinic>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (sheetContext) =>
        _ClinicChoiceSheet(doctorName: doctorName, clinics: clinics),
  );
}

class _ClinicChoiceSheet extends StatelessWidget {
  const _ClinicChoiceSheet({required this.doctorName, required this.clinics});

  final String doctorName;
  final List<ProfessionalClinic> clinics;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 10, 16, 12 + bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.gray300,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              doctorName,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            const Text(
              'Em qual clínica será a visita?',
              style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
            ),
            const SizedBox(height: 12),
            // Scrolls rather than overflowing: a doctor with many affiliations
            // would otherwise push the sheet past the screen.
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: clinics.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, index) {
                  final clinic = clinics[index];
                  return _ClinicTile(
                    clinic: clinic,
                    onTap: () => Navigator.of(context).pop(clinic),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClinicTile extends StatelessWidget {
  const _ClinicTile({required this.clinic, required this.onTap});

  final ProfessionalClinic clinic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final meta = [
      if (clinic.isMain) 'principal',
      if (clinic.role.trim().isNotEmpty) clinic.role.trim(),
      if (clinic.days.trim().isNotEmpty) clinic.days.trim(),
    ].join(' · ');

    return Material(
      color: AppColors.surfaceTertiary,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              const Icon(
                Icons.local_hospital_rounded,
                size: 22,
                color: AppColors.navyBright,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      clinic.name,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray900,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (meta.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        meta,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.gray500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.gray400,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
