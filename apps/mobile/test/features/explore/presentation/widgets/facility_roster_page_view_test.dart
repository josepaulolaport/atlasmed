import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/facility_roster_page_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Widget buildSubject({required bool isLoadingMore}) {
    return MaterialApp(
      home: Scaffold(
        body: FacilityRosterPageView(
          height: 220,
          itemCount: 1,
          hasMore: true,
          isLoadingMore: isLoadingMore,
          onLoadMore: () {},
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
    expect(find.byType(ShaderMask), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
