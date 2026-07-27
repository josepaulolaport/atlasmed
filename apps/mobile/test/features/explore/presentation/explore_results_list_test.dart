import 'package:atlasmed_mobile_app/features/explore/data/models/clinic.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/explore_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/skeleton_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const clinic = Clinic(
    id: 'clinic-1',
    name: 'Clínica Central',
    city: 'São Paulo',
    neighborhood: 'Centro',
    distanceKm: 1,
    commercialStatus: 'ACTIVE',
    lastVisitDays: null,
    doctorCount: 1,
    isPriority: false,
    products: [],
  );

  Widget buildSubject({required bool loadingMore}) {
    return MaterialApp(
      home: Scaffold(
        body: ExploreResultsList(
          items: const [clinic],
          hasMore: true,
          isLoadingMore: loadingMore,
          isClinic: true,
          onLoadMore: () {},
        ),
      ),
    );
  }

  testWidgets('renders one skeleton row only while the next page is loading', (
    tester,
  ) async {
    await tester.pumpWidget(buildSubject(loadingMore: false));

    expect(find.byType(SkeletonRow), findsNothing);

    await tester.pumpWidget(buildSubject(loadingMore: true));

    expect(find.byType(SkeletonRow), findsOneWidget);
    expect(find.byType(ShaderMask), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
