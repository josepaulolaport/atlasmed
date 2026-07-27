import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
    as api;
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Clinic clinicFromLocation({
    String? neighborhood,
    String? city,
    String? state,
    String? commercialStatus,
  }) {
    return Clinic.fromApi(
      api.Clinic(
        id: 'clinic-1',
        name: 'Clínica Central',
        professionalCount: 1,
        neighborhood: neighborhood,
        city: city,
        state: state,
        commercialStatus: commercialStatus,
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
              commercialStatus: 'ACTIVE',
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

  testWidgets('shows commercial status from the API', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ClinicRow(
            clinic: clinicFromLocation(commercialStatus: 'SUSPENDED'),
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.text('Suspensa'), findsOneWidget);
  });

  testWidgets('shows a compact purchase funnel stage when available', (
    tester,
  ) async {
    final clinic = Clinic.fromApi(
      const api.Clinic(
        id: 'clinic-recurrence',
        name: 'Clínica Recorrente',
        professionalCount: 1,
      ),
    );

    // The list model receives the snapshot from the facilities endpoint.
    final withRecurrence = Clinic(
      id: clinic.id,
      name: clinic.name,
      city: clinic.city,
      neighborhood: clinic.neighborhood,
      distanceKm: clinic.distanceKm,
      commercialStatus: clinic.commercialStatus,
      lastVisitDays: clinic.lastVisitDays,
      doctorCount: clinic.doctorCount,
      isPriority: clinic.isPriority,
      products: clinic.products,
      purchaseRecurrence: const PurchaseRecurrenceSnapshot(
        intervalDays: 30,
        sampleSize: 2,
        funnelStage: PurchaseFunnelStage.churn,
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ClinicRow(clinic: withRecurrence, onTap: () {}),
        ),
      ),
    );

    expect(find.text('Churn'), findsOneWidget);
  });

  testWidgets('does not show a funnel chip when recurrence is unavailable', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ClinicRow(
            clinic: const Clinic(
              id: 'clinic-without-recurrence',
              name: 'Clínica sem perfil',
              city: '',
              neighborhood: '',
              distanceKm: null,
              commercialStatus: null,
              lastVisitDays: null,
              doctorCount: 0,
              isPriority: false,
              products: [],
            ),
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.text('Churn'), findsNothing);
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
