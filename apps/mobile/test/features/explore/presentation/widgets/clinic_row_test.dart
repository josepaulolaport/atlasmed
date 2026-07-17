import 'package:atlasmed_mobile_app/features/explore/data/api_types/clinic_api_type.dart'
    as api;
import 'package:atlasmed_mobile_app/features/explore/data/models/clinic.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Clinic clinicFromLocation({
    String? neighborhood,
    String? city,
    String? state,
  }) {
    return Clinic.fromApi(
      api.Clinic(
        id: 'clinic-1',
        name: 'Clínica Central',
        professionalCount: 1,
        neighborhood: neighborhood,
        city: city,
        state: state,
      ),
    );
  }

  testWidgets('hides the complete location row when no location exists', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ClinicRow(
            clinic: const Clinic(
              id: 'clinic-1',
              name: 'Clínica Central',
              city: '',
              neighborhood: '',
              distanceKm: 0,
              status: ClinicStatus.active,
              lastVisitDays: null,
              doctorCount: 1,
              isPriority: false,
              products: [],
            ),
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.location_on_rounded), findsNothing);
  });

  group('Clinic location label', () {
    test('combines neighborhood with city and state', () {
      expect(
        clinicFromLocation(
          neighborhood: 'Centro',
          city: 'Rio de Janeiro',
          state: 'RJ',
        ).locationLabel,
        'Centro · Rio de Janeiro, RJ',
      );
    });

    test('uses city and state when neighborhood is unavailable', () {
      expect(
        clinicFromLocation(city: 'Rio de Janeiro', state: 'RJ').locationLabel,
        'Rio de Janeiro, RJ',
      );
    });

    test('uses neighborhood when city and state are unavailable', () {
      expect(
        clinicFromLocation(neighborhood: 'Centro').locationLabel,
        'Centro',
      );
    });

    test('ignores blank location values', () {
      expect(
        clinicFromLocation(
          neighborhood: '  ',
          city: ' ',
          state: '  ',
        ).locationLabel,
        isNull,
      );
    });

    test('returns null when every location value is unavailable', () {
      expect(clinicFromLocation().locationLabel, isNull);
    });
  });
}
