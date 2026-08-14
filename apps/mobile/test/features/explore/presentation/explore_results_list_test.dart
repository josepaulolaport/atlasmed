import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/doctor_list_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/explore_paged_results.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/skeleton_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  /*
   * The clinics empty state now carries the CNES import entry (spec 0015 §6.0),
   * which is role-gated and therefore reads the current user. That subscription
   * starts a repository fetch whose auto-refresh timer outlives the widget tree
   * and trips `!timersPending`. Background refresh is not what any test in this
   * file is about.
   */
  BaseRepository.autoRefreshEnabled = false;

  const clinicsQuery = ClinicsQuery(limit: 20);
  const doctorsQuery = DoctorsQuery(limit: 20);
  const clinicDto = FacilityDTO(
    id: 1,
    name: 'Clínica Central',
    city: 'São Paulo',
    neighborhood: 'Centro',
    distanceKm: 1,
    professionalCount: 1,
    verticalProfiles: [
      FacilityVerticalProfileDTO(
        verticalId: 1,
        verticalName: 'Ortopedia',
        commercialStatus: 'ACTIVE',
      ),
    ],
  );
  const doctorDto = ProfessionalDTO(
    id: 1,
    firstName: 'Dra.',
    lastName: 'Ana',
    fullName: 'Dra. Ana',
    facilityIds: [],
    specialty: 'Cardiologia',
  );

  testWidgets('renders a skeleton while a virtual page is loading', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clinicsPageProvider.overrideWith((ref, query) {
            if (query.page == 1) {
              return Stream.value(
                const PaginatedFacilities(
                  items: [clinicDto],
                  pagination: Pagination(
                    page: 1,
                    limit: 20,
                    total: 21,
                    totalPages: 2,
                  ),
                ),
              );
            }
            return const Stream<PaginatedFacilities>.empty();
          }),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: ClinicsPagedResults(query: clinicsQuery, bottomInset: 0),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('clinic-row-20')),
      500,
      scrollable: find.byType(Scrollable),
      maxScrolls: 10,
    );
    await tester.pump();

    expect(find.byType(SkeletonRow), findsWidgets);
  });

  testWidgets('global index 20 renders page two offset zero', (tester) async {
    final secondPageClinic = FacilityDTO(
      id: 21,
      name: 'Clínica da página 2',
      professionalCount: 0,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clinicsPageProvider.overrideWith((ref, query) {
            if (query.page == 1) {
              return Stream.value(
                const PaginatedFacilities(
                  items: [clinicDto],
                  pagination: Pagination(
                    page: 1,
                    limit: 20,
                    total: 21,
                    totalPages: 2,
                  ),
                ),
              );
            }
            return Stream.value(
              PaginatedFacilities(
                items: [secondPageClinic],
                pagination: const Pagination(
                  page: 2,
                  limit: 20,
                  total: 21,
                  totalPages: 2,
                ),
              ),
            );
          }),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: ClinicsPagedResults(query: clinicsQuery, bottomInset: 0),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Clínica da página 2'),
      500,
      scrollable: find.byType(Scrollable),
      maxScrolls: 10,
    );

    expect(find.text('Clínica da página 2'), findsOneWidget);
  });

  testWidgets('empty results remain pull-to-refresh capable', (tester) async {
    var refreshCount = 0;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clinicsPageProvider.overrideWith(
            (ref, query) => Stream.value(
              const PaginatedFacilities(
                items: [],
                pagination: Pagination(
                  page: 1,
                  limit: 20,
                  total: 0,
                  totalPages: 0,
                ),
              ),
            ),
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: ClinicsPagedResults(
              query: clinicsQuery,
              bottomInset: 0,
              onRefresh: () async => refreshCount++,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(RefreshIndicator), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, 500));
    await tester.pumpAndSettle();

    expect(refreshCount, 1);
  });

  testWidgets('preserves selected vertical when opening a clinic', (
    tester,
  ) async {
    String? navigatedLocation;
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(
            body: ClinicsPagedResults(
              query: clinicsQuery,
              bottomInset: 0,
              preferredVerticalId: 1,
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

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clinicsPageProvider.overrideWith(
            (ref, query) => Stream.value(
              const PaginatedFacilities(
                items: [clinicDto],
                pagination: Pagination(
                  page: 1,
                  limit: 20,
                  total: 1,
                  totalPages: 1,
                ),
              ),
            ),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Clínica Central'));
    await tester.pumpAndSettle();

    expect(navigatedLocation, '/explore/clinic/1?verticalId=1');
  });

  testWidgets('opens a clinic through the explore route', (tester) async {
    String? navigatedLocation;
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(
            body: ClinicsPagedResults(query: clinicsQuery, bottomInset: 0),
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

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clinicsPageProvider.overrideWith(
            (ref, query) => Stream.value(
              const PaginatedFacilities(
                items: [clinicDto],
                pagination: Pagination(
                  page: 1,
                  limit: 20,
                  total: 1,
                  totalPages: 1,
                ),
              ),
            ),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Clínica Central'));
    await tester.pumpAndSettle();

    expect(navigatedLocation, '/explore/clinic/1');
  });

  testWidgets('opens a doctor through the explore route', (tester) async {
    String? navigatedLocation;
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(
            body: DoctorsPagedResults(query: doctorsQuery, bottomInset: 0),
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

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          doctorsPageProvider.overrideWith(
            (ref, query) => Stream.value(
              const PaginatedProfessionals(
                items: [doctorDto],
                pagination: Pagination(
                  page: 1,
                  limit: 20,
                  total: 1,
                  totalPages: 1,
                ),
              ),
            ),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dra. Ana'));
    await tester.pumpAndSettle();

    expect(navigatedLocation, '/explore/doctor/1');
  });
}
