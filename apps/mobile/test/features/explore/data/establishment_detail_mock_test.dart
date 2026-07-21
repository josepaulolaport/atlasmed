import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';

void main() {
  test('filterNearbyByRadius respects radius', () {
    final all = mockEstablishmentDetailSections(
      'facility-1',
    ).nearbyEstablishments;

    final within5 = filterNearbyByRadius(all, 5);
    expect(within5.every((e) => e.distanceKm <= 5), isTrue);
    expect(within5.length, lessThan(all.length));

    final within50 = filterNearbyByRadius(all, 50);
    expect(within50.length, all.length);
  });

  test('facility doctor roster pages until hasMore is false', () async {
    final all = mockAllFacilityDoctors('facility-1');
    expect(all.length, greaterThan(facilityRosterPageSize));

    final page1 = await mockFacilityDoctorsPage(
      facilityId: 'facility-1',
      page: 1,
    );
    expect(page1.items.length, facilityRosterPageSize);
    expect(page1.pagination.page, 1);
    expect(page1.pagination.total, all.length);
    expect(page1.pagination.totalPages, greaterThan(1));
    expect(page1.pagination.page < page1.pagination.totalPages, isTrue);

    final lastPage = await mockFacilityDoctorsPage(
      facilityId: 'facility-1',
      page: page1.pagination.totalPages,
    );
    expect(lastPage.pagination.page, page1.pagination.totalPages);
    expect(lastPage.pagination.page < lastPage.pagination.totalPages, isFalse);

    // First page must not dump the full catalog into the strip.
    expect(page1.items.length, lessThan(all.length));
  });

  test('empty facility roster has no pages to load', () async {
    final page = await mockFacilityAdministratorsPage(
      facilityId: 'facility-1:empty',
      page: 1,
    );
    expect(page.items, isEmpty);
    expect(page.pagination.total, 0);
    expect(page.pagination.totalPages, 0);
  });
}
