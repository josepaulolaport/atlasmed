import 'package:atlasmed_mobile_app/features/explore/data/models/clinic_sort_option.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:flutter_test/flutter_test.dart';

/// The ordering the Médicos tab can actually be in.
///
/// Both tabs share one `sort` value and do not share a vocabulary: the doctors
/// endpoint accepts `name` and nothing else (`SORTS = ["name"]`). Choosing
/// "Mais próximos" on Clínicas and switching to Médicos left the request
/// without a sort — so the server ordered by name — while the chip still read
/// "Distância" over a list running 1073 km, 22 km, 2267 km, 2256 km.

void main() {
  group('effectiveDoctorSortKey', () {
    test('keeps a name ordering the tab can honour', () {
      expect(effectiveDoctorSortKey('name-asc'), 'name-asc');
      expect(effectiveDoctorSortKey('name-desc'), 'name-desc');
    });

    test('falls back for every clinic-only key', () {
      // These are the keys `SortSheet(kind: "clinic")` can leave in the shared
      // state. None of them means anything to the doctors endpoint.
      for (final key in [
        'distance',
        'purchase-funnel-asc',
        'purchase-funnel-desc',
        'purchase-interval-asc',
        'purchase-interval-desc',
        'last-purchase-asc',
        'last-purchase-desc',
      ]) {
        expect(
          effectiveDoctorSortKey(key),
          'name-asc',
          reason: '$key must not be shown as the médicos ordering',
        );
      }
    });

    test('an unknown key is name ascending, not nothing', () {
      expect(effectiveDoctorSortKey('quem-sabe'), 'name-asc');
    });
  });

  group('doctorSortForKey', () {
    test('always asks for a sort the endpoint accepts', () {
      // The defect: this resolved to (null, null) for anything clinic-only,
      // which let the request fall back to a default the UI never showed.
      for (final key in [
        'name-asc',
        'name-desc',
        'distance',
        'last-purchase-desc',
        'nonsense',
      ]) {
        final resolved = doctorSortForKey(key);
        expect(resolved.sort, FacilitySort.name, reason: key);
        expect(resolved.order, isNotNull, reason: key);
      }
    });

    test('carries the direction through', () {
      expect(doctorSortForKey('name-desc').order, SortOrder.desc);
      expect(doctorSortForKey('name-asc').order, SortOrder.asc);
      // A clinic-only key resolves to the fallback, ascending.
      expect(doctorSortForKey('distance').order, SortOrder.asc);
    });

    test('agrees with the label the chip shows', () {
      // The two must not be able to disagree — that disagreement is the bug.
      for (final key in ['name-asc', 'name-desc', 'distance', 'nonsense']) {
        final label = effectiveDoctorSortKey(key);
        final resolved = doctorSortForKey(key);
        expect(
          resolved.order,
          label == 'name-desc' ? SortOrder.desc : SortOrder.asc,
          reason: key,
        );
      }
    });
  });

  group('clinicSortForKey', () {
    test('offers distance only where there is an origin', () {
      expect(
        clinicSortForKey('distance', hasLocation: true).sort,
        FacilitySort.distance,
      );
      // No origin, no distance sort — the list would otherwise ask the server
      // to order by a number it cannot compute.
      expect(clinicSortForKey('distance', hasLocation: false).sort, isNull);
    });

    test('maps each sheet key to its own ordering', () {
      expect(clinicSortForKey('name-desc').order, SortOrder.desc);
      expect(
        clinicSortForKey('purchase-funnel-asc').sort,
        FacilitySort.purchaseFunnelStage,
      );
      expect(
        clinicSortForKey('last-purchase-desc').sort,
        FacilitySort.lastPurchaseDate,
      );
      expect(
        clinicSortForKey('purchase-interval-asc').sort,
        FacilitySort.purchaseIntervalDays,
      );
    });
  });
}
