import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/clinic_visit_screen.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:flutter/material.dart';

/// Opens the visit screen for one clinic.
///
/// A visit is still an agenda interaction and still goes through the calendar
/// editor's controller, validation and submit — but not through its form. That
/// screen builds *any* calendar entry, so it opens by asking whether this is an
/// interação or a bloqueio pessoal and then offers a clinic picker. Both are
/// already answered by the time somebody taps "Visita" on a clinic, and leaving
/// them on screen only gives the rep a way to contradict themselves.
Future<void> openClinicVisitScheduler(
  BuildContext context, {
  required int facilityId,
  required String facilityName,
}) {
  return Navigator.of(context).push<bool>(
    MaterialPageRoute(
      builder: (_) =>
          ClinicVisitScreen(facilityId: facilityId, facilityName: facilityName),
    ),
  );
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
