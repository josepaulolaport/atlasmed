import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/facility_roster_page_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Widget buildSubject({
    required bool isLoadingMore,
    int itemCount = 1,
    VoidCallback? onLoadMore,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: FacilityRosterPageView(
          height: 220,
          itemCount: itemCount,
          hasMore: true,
          isLoadingMore: isLoadingMore,
          onLoadMore: onLoadMore ?? () {},
          itemBuilder: (_, _) => const SizedBox.expand(),
        ),
      ),
    );
  }

  testWidgets('shows its trailing shimmer only during a next-page request', (
    tester,
  ) async {
    await tester.pumpWidget(buildSubject(isLoadingMore: false));

    expect(find.byType(FacilityRosterPaginationSkeleton), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);

    await tester.pumpWidget(buildSubject(isLoadingMore: true));

    expect(find.byType(FacilityRosterPaginationSkeleton), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets(
    'keeps an idle has-more end extent that can request the next page',
    (tester) async {
      var loadMoreCalls = 0;
      await tester.pumpWidget(
        buildSubject(
          isLoadingMore: false,
          itemCount: 2,
          onLoadMore: () => loadMoreCalls++,
        ),
      );

      expect(find.byType(FacilityRosterPaginationSkeleton), findsNothing);

      await tester.drag(find.byType(ListView), const Offset(-1000, 0));
      await tester.pump();

      expect(loadMoreCalls, greaterThan(0));
    },
  );
}
