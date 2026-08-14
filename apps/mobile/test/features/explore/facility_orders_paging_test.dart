import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_orders_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_orders_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// "Pedidos recentes" on the clinic detail.
///
/// It fetched five orders and stopped. One clinic in the production snapshot
/// has eighty, so seventy-five were unreachable — and the section header
/// counted the list it held, advertising "5" for that clinic.

FacilityOrderSummary order(int id) => FacilityOrderSummary(
  id: id,
  displayId: 'PED-$id',
  status: 'INVOICED',
  type: 'SALE',
  orderedAt: DateTime.utc(2026, 3, id.clamp(1, 28)),
  total: 100,
  itemCount: 1,
  items: const [],
);

void main() {
  group('FacilityOrdersPage', () {
    test('reads the clinic total, not the page length', () {
      final page = FacilityOrdersPage.fromJson({
        'data': [
          for (var i = 1; i <= 5; i++)
            {'id': i, 'status': 'INVOICED', 'type': 'SALE', 'total': 100},
        ],
        'pagination': {'page': 1, 'limit': 5, 'total': 80, 'totalPages': 16},
      });

      expect(page.orders, hasLength(5));
      expect(page.total, 80);
      expect(page.hasNextPage, isTrue);
    });

    test('knows it is on the last page', () {
      final page = FacilityOrdersPage.fromJson({
        'data': const [],
        'pagination': {'page': 16, 'limit': 5, 'total': 80, 'totalPages': 16},
      });

      expect(page.hasNextPage, isFalse);
    });

    test('survives a payload with no pagination block', () {
      // Defensive: the section should degrade to one page rather than throw.
      final page = FacilityOrdersPage.fromJson({
        'data': [
          {'id': 1, 'status': 'INVOICED', 'type': 'SALE', 'total': 10},
        ],
      });

      expect(page.orders, hasLength(1));
      expect(page.total, 1);
      expect(page.hasNextPage, isFalse);
    });
  });

  group('ClinicOrdersSection', () {
    testWidgets('asks for the next page as the rep nears the end', (
      tester,
    ) async {
      var loadMoreCalls = 0;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ClinicOrdersSection(
              orders: [for (var i = 1; i <= 5; i++) order(i)],
              facilityId: 1,
              hasMore: true,
              onLoadMore: () => loadMoreCalls++,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(loadMoreCalls, 0, reason: 'nothing until the rep swipes');

      // Swipe towards the end of what is loaded.
      for (var i = 0; i < 3; i++) {
        // fling, not drag: a page is ~688px wide at viewportFraction 0.86, so
        // a short drag snaps back and never advances.
        await tester.fling(find.byType(PageView), const Offset(-400, 0), 1200);
        await tester.pumpAndSettle();
      }

      expect(loadMoreCalls, greaterThan(0));
    });

    testWidgets('never asks when there is nothing more', (tester) async {
      var loadMoreCalls = 0;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ClinicOrdersSection(
              orders: [for (var i = 1; i <= 5; i++) order(i)],
              facilityId: 1,
              hasMore: false,
              onLoadMore: () => loadMoreCalls++,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      for (var i = 0; i < 4; i++) {
        // fling, not drag: a page is ~688px wide at viewportFraction 0.86, so
        // a short drag snaps back and never advances.
        await tester.fling(find.byType(PageView), const Offset(-400, 0), 1200);
        await tester.pumpAndSettle();
      }

      expect(loadMoreCalls, 0);
    });

    testWidgets('shows a trailing spinner while the next page is in flight', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ClinicOrdersSection(
              orders: [for (var i = 1; i <= 5; i++) order(i)],
              facilityId: 1,
              hasMore: true,
              loadingMore: true,
              onLoadMore: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      // Six pages for five orders — the carousel does not stop dead at the
      // last loaded card while more are coming.
      final pageView = tester.widget<PageView>(find.byType(PageView));
      expect(pageView.childrenDelegate.estimatedChildCount, 6);
    });

    testWidgets('still renders the empty state with no orders', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: ClinicOrdersSection(orders: [], facilityId: 1)),
        ),
      );

      expect(find.text('Nenhum pedido registrado'), findsOneWidget);
    });
  });
}
