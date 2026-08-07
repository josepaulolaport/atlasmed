import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PurchaseRecurrenceSnapshot', () {
    test('parses the complete facility response', () {
      final facility = FacilityDTO.fromMap({
        'id': 1,
        'name': 'Clínica Central',
        'professionalCount': 2,
        'verticalProfiles': [
          {
            'verticalId': 1,
            'verticalName': 'Ortopedia',
            'purchaseRecurrence': {
              'observedIntervalDays': 31,
              'intervalDays': 30,
              'source': 'CALCULATED',
              'profile': 'MONTHLY',
              'lastPurchaseDate': '2026-07-03',
              'sampleSize': 5,
              'funnelStage': 'PURCHASE_WINDOW',
              'nextTransitionDate': '2026-08-15',
            },
          },
        ],
      });

      final recurrence = pickVerticalProfile(facility.verticalProfiles)!
          .purchaseRecurrence!;
      expect(recurrence.observedIntervalDays, 31);
      expect(recurrence.intervalDays, 30);
      expect(recurrence.source, PurchaseRecurrenceSource.calculated);
      expect(recurrence.profile, PurchaseProfile.monthly);
      expect(recurrence.lastPurchaseDate, DateTime(2026, 7, 3));
      expect(recurrence.sampleSize, 5);
      expect(recurrence.funnelStage, PurchaseFunnelStage.purchaseWindow);
      expect(recurrence.nextTransitionDate, DateTime(2026, 8, 15));
    });

    test('preserves raw unknown enum values without defaulting them', () {
      final facility = FacilityDTO.fromMap({
        'id': 1,
        'name': 'Clínica Central',
        'professionalCount': 0,
        'verticalProfiles': [
          {
            'verticalId': 1,
            'verticalName': 'Ortopedia',
            'purchaseRecurrence': {
              'observedIntervalDays': null,
              'intervalDays': 45,
              'source': 'FUTURE_SOURCE',
              'profile': 'FUTURE_PROFILE',
              'lastPurchaseDate': null,
              'sampleSize': 0,
              'funnelStage': 'FUTURE_STAGE',
              'nextTransitionDate': null,
            },
          },
        ],
      });

      final recurrence = pickVerticalProfile(facility.verticalProfiles)!
          .purchaseRecurrence!;
      expect(recurrence.source, isNull);
      expect(recurrence.rawSource, 'FUTURE_SOURCE');
      expect(recurrence.funnelStage, isNull);
      expect(recurrence.rawFunnelStage, 'FUTURE_STAGE');
      expect(recurrence.profile, isNull);
      expect(recurrence.rawProfile, 'FUTURE_PROFILE');
      expect(recurrence.hasUnknownEnums, isTrue);
      expect(recurrence.lastPurchaseDate, isNull);
    });
  });

  group('date-only parsing', () {
    test('accepts only exact calendar-valid YYYY-MM-DD values', () {
      expect(parseDateOnly('2026-02-28'), DateTime(2026, 2, 28));
      expect(parseDateOnly('2026-02-31'), isNull);
      expect(parseDateOnly('2026-2-03'), isNull);
      expect(parseDateOnly('26-02-03'), isNull);
      expect(parseDateOnly('2026-02-03T00:00:00Z'), isNull);
      expect(parseDateOnly(null), isNull);
    });
  });

  group('ClinicsRepository purchase query', () {
    test('serializes funnel, profile, interval and server sort parameters', () {
      final endpoint = ClinicsRepository.makeEndpoint(
        baseUrl: 'https://api.example.test',
        page: 1,
        limit: 20,
        purchaseFunnelStages: const [
          PurchaseFunnelStage.neverPurchased,
          PurchaseFunnelStage.churn,
        ],
        purchaseProfile: PurchaseProfile.monthly,
        purchaseIntervalMinDays: 20,
        purchaseIntervalMaxDays: 60,
        sort: FacilitySort.purchaseIntervalDays,
        order: SortOrder.desc,
      );

      expect(
        endpoint.queryParameters,
        containsPair('purchaseFunnelStage', 'NEVER_PURCHASED,CHURN'),
      );
      expect(
        endpoint.queryParameters,
        containsPair('purchaseProfile', 'MONTHLY'),
      );
      expect(
        endpoint.queryParameters,
        containsPair('purchaseIntervalMinDays', '20'),
      );
      expect(
        endpoint.queryParameters,
        containsPair('purchaseIntervalMaxDays', '60'),
      );
      expect(
        endpoint.queryParameters,
        containsPair('sort', 'purchaseIntervalDays'),
      );
      expect(endpoint.queryParameters, containsPair('order', 'desc'));
    });
  });

  test('commercial status query uses one exact API enum value', () {
    final endpoint = ClinicsRepository.makeEndpoint(
      baseUrl: 'https://api.example.test',
      page: 1,
      limit: 20,
      commercialStatus: CommercialStatus.suspended.apiValue,
    );

    expect(endpoint.queryParameters['commercialStatus'], 'SUSPENDED');
  });

  test('API clinic parses commercial status without inventing a default', () {
    final active = FacilityDTO.fromMap({
      'id': 1,
      'name': 'Clínica Central',
      'professionalCount': 0,
      'verticalProfiles': [
        {
          'verticalId': 1,
          'verticalName': 'Ortopedia',
          'commercialStatus': 'REGISTERED',
        },
      ],
    });
    final absent = FacilityDTO.fromMap({
      'id': 2,
      'name': 'Clínica Sem Status',
      'professionalCount': 0,
    });

    expect(
      pickVerticalProfile(active.verticalProfiles)?.commercialStatus,
      'REGISTERED',
    );
    expect(pickVerticalProfile(absent.verticalProfiles), isNull);
  });

  test('builds the PATCH request with the typed command payload', () {
    final request = FacilityPurchaseRecurrenceRepository.makePatchRequest(
      'https://api.example.test',
      1,
      const PresetPurchaseRecurrence(PurchaseProfile.monthly),
    );

    expect(
      request.url.toString(),
      'https://api.example.test/api/v1/facilities/1',
    );
    expect(request.method.name, 'patch');
    expect(request.body, {
      'purchaseRecurrence': {'mode': 'PRESET', 'profile': 'MONTHLY'},
    });
  });

  group('Purchase recurrence commands', () {
    test('builds automatic, preset and custom payloads', () {
      expect(const AutomaticPurchaseRecurrence().toJson(), {
        'purchaseRecurrence': {'mode': 'AUTOMATIC'},
      });
      expect(const PresetPurchaseRecurrence(PurchaseProfile.monthly).toJson(), {
        'purchaseRecurrence': {'mode': 'PRESET', 'profile': 'MONTHLY'},
      });
      expect(const CustomPurchaseRecurrence(45).toJson(), {
        'purchaseRecurrence': {'mode': 'CUSTOM', 'intervalDays': 45},
      });
    });

    test('rejects custom intervals outside 1 through 3650', () {
      expect(
        () => const CustomPurchaseRecurrence(0).validate(),
        throwsArgumentError,
      );
      expect(
        () => const CustomPurchaseRecurrence(3651).validate(),
        throwsArgumentError,
      );
    });
  });
}
