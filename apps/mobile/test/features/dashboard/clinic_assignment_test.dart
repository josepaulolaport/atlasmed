import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/clinic_assignment_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('UnassignReason (spec 0015 R7)', () {
    test('every motivo carries a wire value the API accepts', () {
      // The API validates against a fixed union; a label the server rejects
      // would fail only at the moment someone tried to use it.
      const accepted = {
        'manual_unassign',
        'rep_changed',
        'clinic_closed',
        'wrong_assignment',
      };

      for (final reason in UnassignReason.values) {
        expect(accepted, contains(reason.wireValue));
        expect(reason.label.isNotEmpty, isTrue);
      }
    });

    test('offers no reason that belongs to the system', () {
      // `reassigned`, `boundary_impact` and `vertical_deactivated` are things
      // the system did. A person filing a decision under a machine's name makes
      // the churn report unreadable in the direction that matters.
      final wire = UnassignReason.values.map((r) => r.wireValue).toSet();

      expect(wire, isNot(contains('reassigned')));
      expect(wire, isNot(contains('boundary_impact')));
      expect(wire, isNot(contains('vertical_deactivated')));
    });

    test('"outro" keeps the historical catch-all rather than a new value', () {
      // Rows written before the vocabulary existed say `manual_unassign`.
      // Reusing it keeps one meaning — "unassigned, unexplained" — instead of
      // splitting it across two spellings nobody can aggregate.
      expect(UnassignReason.other.wireValue, 'manual_unassign');
    });
  });

  group('AssignableClinic (spec 0015 R6)', () {
    test(
      'reads whether a reason is due from the server, not from geometry',
      () {
        final clinic = AssignableClinic.fromJson({
          'facilityId': 12,
          'name': 'Clínica Santa Rita',
          'city': 'Niterói',
          'state': 'RJ',
          'currentRepName': null,
          'currentRepId': null,
          'requiresReason': false,
        });

        expect(clinic.requiresReason, isFalse);
        expect(clinic.currentRepId, isNull);
        expect(clinic.locationLabel, 'Niterói · RJ');
      },
    );

    test('defaults to requiring a reason when the field is absent', () {
      // Failing closed: assigning outside a patch without a record is the one
      // outcome I2 forbids, so an unknown answer must not read as "covered".
      final clinic = AssignableClinic.fromJson({
        'facilityId': 12,
        'name': 'Clínica',
        'city': '',
        'state': '',
      });

      expect(clinic.requiresReason, isTrue);
    });

    test('carries the current holder, so a takeover can name them', () {
      final clinic = AssignableClinic.fromJson({
        'facilityId': 12,
        'name': 'Clínica',
        'city': 'Rio de Janeiro',
        'state': 'RJ',
        'currentRepName': 'Mauro Araujo',
        'currentRepId': 4,
        'requiresReason': true,
      });

      expect(clinic.currentRepName, 'Mauro Araujo');
      expect(clinic.currentRepId, 4);
    });
  });
}
