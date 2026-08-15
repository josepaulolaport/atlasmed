import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('CRM detail routes serialize int path/query segments', () {
    expect(
      ClinicDetailRoute(id: 1, verticalId: 2).location,
      '/explore/clinic/1?verticalId=2',
    );
    expect(
      DoctorDetailRoute(id: 9, facilityId: 3).location,
      '/explore/doctor/9?facilityId=3',
    );
    expect(OrderDetailRoute(id: 42).location, '/orders/42');
    expect(UserDetailRoute(id: 7).location, '/users/7');
    expect(UserAssignmentsRoute(id: 7).location, '/users/7/assignments');
    expect(
      InvitationDetailRoute(invitationId: 11).location,
      '/users/invitations/11',
    );
    expect(const InviteUserRoute().location, '/users/invite');
  });

  test('desempenho drill-downs carry the whole scope', () {
    // Spec 0014 §4.1: the breakdown must answer for the same population the
    // card counted, so every filter travels with it.
    expect(
      MetricClinicsRoute(
        metric: 'coverage',
        verticalId: 1,
        stateIds: '35,33',
        repIds: '7',
      ).location,
      '/dashboard/metrics/coverage/clinics?verticalId=1&repIds=7&stateIds=35%2C33',
    );
    expect(
      SubjectDashboardRoute(subjectUserId: 5, subjectName: 'Ana').location,
      '/team/member/5?subjectName=Ana',
    );
    // The subject's role rides along so the screen knows which cards may be
    // asked about them: "Clínicas não atribuídas" is a zone question, and a rep
    // holds no zones, so requesting it for one earns a 403.
    expect(
      SubjectDashboardRoute(
        subjectUserId: 5,
        subjectName: 'Ana',
        subjectRole: 'REP',
      ).location,
      '/team/member/5?subjectName=Ana&subjectRole=REP',
    );
    expect(TeamMemberRoute(managerId: 2).location, '/team/manager/2');
    expect(const RepsWithoutPatchRoute().location, '/team/reps-without-patch');
  });

  test('shell + auth locations stay stable', () {
    expect(const DashboardRoute().location, '/dashboard');
    expect(const TeamRoute().location, '/team');
    expect(const ExploreRoute().location, '/explore');
    expect(const AgendaRoute().location, '/agenda');
    expect(const UsersRoute().location, '/users');
    expect(const SplashRoute().location, '/splash');
    expect(const LoginRoute().location, '/splash/login');
    expect(
      const RegisterInviteRoute(token: 'abc').location,
      '/splash/login/register?token=abc',
    );
  });

  test('a seeded appointment keeps its seed in the URL', () {
    // The router refreshes on the session, and a refresh rebuilds the matches
    // from the location alone — anything passed as `extra` is gone by then, and
    // the editor reopens empty over a form the rep had already filled. So the
    // clinic travels as query parameters and survives the rebuild.
    final location = AgendaNewRoute(
      facilityId: 11,
      facilityName: 'Centro Reumatologico Botafogo',
      title: 'Visita · Centro Reumatologico Botafogo',
    ).location;

    final uri = Uri.parse(location);
    expect(uri.path, '/agenda/new');
    expect(uri.queryParameters['facility-id'], '11');
    expect(
      uri.queryParameters['facility-name'],
      'Centro Reumatologico Botafogo',
    );
    expect(
      uri.queryParameters['title'],
      'Visita · Centro Reumatologico Botafogo',
    );

    // Opened from the agenda's own "+", it carries nothing.
    expect(const AgendaNewRoute().location, '/agenda/new');

    // From a doctor whose clinics are outside the viewer's territory: the
    // subject travels, the clinic is left for the form to ask.
    expect(
      const AgendaNewRoute(title: 'Visita · Dra. Helena').location,
      '/agenda/new?title=Visita+%C2%B7+Dra.+Helena',
    );
  });

  test('agenda occurrence edit encodes recurrenceKey', () {
    const key = '2026-08-17T12:00[America/Sao_Paulo]';
    expect(
      AgendaOccurrenceEditRoute(id: 5, recurrenceKey: key).location,
      '/agenda/5/occurrences/${Uri.encodeComponent(key)}/edit',
    );
  });
}
