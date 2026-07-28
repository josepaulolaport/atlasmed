import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/explore_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/skeleton_row.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';

import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  const clinic = FacilityEntry(
    id: 'clinic-1',
    name: 'Clínica Central',
    city: 'São Paulo',
    neighborhood: 'Centro',
    distanceKm: 1,
    commercialStatus: 'REGISTERED',
    doctorCount: 1,
  );

  Widget buildSubject({required bool loadingMore}) {
    return MaterialApp(
      home: Scaffold(
        body: ExploreResultsList(
          items: const [Left(clinic)],
          hasMore: true,
          isLoadingMore: loadingMore,
          onLoadMore: () {},
          bottomInset: 0,
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
    expect(find.byType(AtlasShimmer), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  const doctor = ProfessionalEntry(
    id: 'doctor-1',
    name: 'Dra. Ana',
    initials: 'DA',
    hue: 0,
    specialty: 'Cardiologia',
    crm: '12345',
    distanceKm: null,
  );

  testWidgets('opens a clinic through the explore route', (tester) async {
    String? navigatedLocation;
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => Scaffold(
            body: ExploreResultsList(
              items: const [Left(clinic)],
              hasMore: false,
              isLoadingMore: false,
              onLoadMore: () {},
              bottomInset: 0,
            ),
          ),
        ),
        GoRoute(
          path: '/explore/clinic/:id',
          builder: (_, state) {
            navigatedLocation = state.uri.toString();
            return const SizedBox();
          },
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.tap(find.text('Clínica Central'));
    await tester.pumpAndSettle();

    expect(navigatedLocation, '/explore/clinic/clinic-1');
  });

  testWidgets('opens a doctor through the explore route', (tester) async {
    String? navigatedLocation;
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => Scaffold(
            body: ExploreResultsList(
              items: const [Right(doctor)],
              hasMore: false,
              isLoadingMore: false,
              onLoadMore: () {},
              bottomInset: 0,
            ),
          ),
        ),
        GoRoute(
          path: '/explore/doctor/:id',
          builder: (_, state) {
            navigatedLocation = state.uri.toString();
            return const SizedBox();
          },
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.tap(find.text('Dra. Ana'));
    await tester.pumpAndSettle();

    expect(navigatedLocation, '/explore/doctor/doctor-1');
  });
}
