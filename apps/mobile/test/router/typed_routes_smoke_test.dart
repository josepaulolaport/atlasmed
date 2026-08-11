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
        stateId: 35,
        repId: 7,
      ).location,
      '/dashboard/metrics/coverage/clinics?verticalId=1&repId=7&stateId=35',
    );
    expect(
      SubjectDashboardRoute(subjectUserId: 5, subjectName: 'Ana').location,
      '/team/member/5?subjectName=Ana',
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

  test('agenda occurrence edit encodes recurrenceKey', () {
    const key = '2026-08-17T12:00[America/Sao_Paulo]';
    expect(
      AgendaOccurrenceEditRoute(id: 5, recurrenceKey: key).location,
      '/agenda/5/occurrences/${Uri.encodeComponent(key)}/edit',
    );
  });

  test('new order query camelCase preserved', () {
    expect(
      NewOrderRoute(
        interactionId: 1,
        facilityId: 2,
        facilityName: 'Clinica',
      ).location,
      '/orders/new?interactionId=1&facilityId=2&facilityName=Clinica',
    );
  });
}
