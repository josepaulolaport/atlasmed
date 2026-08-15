import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:flutter/widgets.dart';

/// Opens the agenda's interaction editor with the clinic already settled.
///
/// A visit *is* an agenda interaction, so scheduling one reuses
/// `CalendarEditorScreen` rather than growing a second form: the rep picks a
/// date, time, duration and modality in the one place those fields already
/// exist, and the appointment lands in their agenda. Coming from the clinic's
/// own page there is nothing left to ask about the clinic, so the editor shows
/// it fixed rather than as a search box.
void openClinicVisitScheduler(
  BuildContext context, {
  required int facilityId,
  required String facilityName,
}) {
  AgendaNewRoute(
    facilityId: facilityId,
    facilityName: facilityName,
    title: 'Visita · $facilityName',
  ).push(context);
}

/// Opens the same editor for a visit to a professional.
///
/// The clinic is still required — the agenda stores a facility, not a person —
/// but the editor offers only the clinics this professional works at instead of
/// every clinic in the country. Which ones those are is a question for the
/// editor, not for a sheet in front of it: one screen, one place to answer.
void openProfessionalVisitScheduler(
  BuildContext context, {
  required int personId,
  required String personName,
}) {
  AgendaNewRoute(
    personId: personId,
    personName: personName,
    title: 'Visita · $personName',
  ).push(context);
}
