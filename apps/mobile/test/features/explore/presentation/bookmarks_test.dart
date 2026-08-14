import 'dart:async';

import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/bookmarks_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/bookmarks_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/favoritos_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/bookmark_icon_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Records what the toggle asked the API to do, with test-controlled timing.
///
/// The call has to be *hold-able*: asserting the optimistic state only means
/// something while the request is still in flight, and a fake that settles on
/// the first microtask has already reverted by the time `pump()` returns.
class _FakeToggleRepository implements BookmarkToggleApi {
  _FakeToggleRepository({this.fails = false, this.hold = false});

  final bool fails;
  final bool hold;
  final List<({BookmarkKind kind, int id, bool bookmarked})> calls = [];
  final Completer<void> _gate = Completer<void>();

  /// Lets a held call finish, failing it when [fails] is set.
  void release() {
    if (_gate.isCompleted) return;
    if (fails) {
      _gate.completeError(const BookmarkException('offline'));
    } else {
      _gate.complete();
    }
  }

  @override
  Future<void> setBookmarked({
    required BookmarkKind kind,
    required int id,
    required bool bookmarked,
  }) async {
    calls.add((kind: kind, id: id, bookmarked: bookmarked));
    if (hold) return _gate.future;
    if (fails) throw const BookmarkException('offline');
  }
}

const _clinicDto = FacilityDTO(
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

const _doctorDto = ProfessionalDTO(
  id: 5,
  firstName: 'Dra.',
  lastName: 'Ana',
  fullName: 'Dra. Ana',
  facilityIds: [],
  specialty: 'Cardiologia',
);

const _emptyFacilities = PaginatedFacilities(
  items: [],
  pagination: Pagination(page: 1, limit: 20, total: 0, totalPages: 1),
);

const _emptyProfessionals = PaginatedProfessionals(
  items: [],
  pagination: Pagination(page: 1, limit: 20, total: 0, totalPages: 1),
);

Widget _toggleHarness(_FakeToggleRepository fake) {
  return ProviderScope(
    overrides: [bookmarkToggleRepositoryProvider.overrideWithValue(fake)],
    child: const MaterialApp(
      home: Scaffold(
        body: BookmarkIconButton(kind: BookmarkKind.clinic, id: 1),
      ),
    ),
  );
}

void main() {
  group('BookmarkIconButton', () {
    testWidgets('starts hollow and fills immediately on tap', (tester) async {
      final fake = _FakeToggleRepository();
      await tester.pumpWidget(_toggleHarness(fake));

      expect(find.byIcon(Icons.bookmark_border_rounded), findsOneWidget);

      await tester.tap(find.byType(IconButton));
      await tester.pump();

      // Filled before the request settles — this is the optimistic half. If it
      // only filled after `await`, the button would feel dead on a slow link.
      expect(find.byIcon(Icons.bookmark_rounded), findsOneWidget);

      await tester.pumpAndSettle();
      expect(fake.calls, [
        (kind: BookmarkKind.clinic, id: 1, bookmarked: true),
      ]);
      expect(find.byIcon(Icons.bookmark_rounded), findsOneWidget);
    });

    testWidgets('reverts and explains when the server refuses', (tester) async {
      final fake = _FakeToggleRepository(fails: true, hold: true);
      await tester.pumpWidget(_toggleHarness(fake));

      await tester.tap(find.byType(IconButton));
      await tester.pump();
      // Filled while the request is still in flight.
      expect(find.byIcon(Icons.bookmark_rounded), findsOneWidget);

      fake.release();
      await tester.pumpAndSettle();

      /// The failure this whole widget exists to prevent: a filled icon for a
      /// bookmark the server never accepted.
      expect(find.byIcon(Icons.bookmark_border_rounded), findsOneWidget);
      expect(find.byIcon(Icons.bookmark_rounded), findsNothing);
      expect(
        find.text('Não foi possível atualizar os favoritos'),
        findsOneWidget,
      );
    });

    testWidgets('un-bookmarks a saved clinic', (tester) async {
      final fake = _FakeToggleRepository();
      await tester.pumpWidget(_toggleHarness(fake));

      await tester.tap(find.byType(IconButton));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(IconButton));
      await tester.pumpAndSettle();

      expect(fake.calls.map((c) => c.bookmarked), [true, false]);
      expect(find.byIcon(Icons.bookmark_border_rounded), findsOneWidget);
    });

    testWidgets('ignores a second tap while the first is in flight', (
      tester,
    ) async {
      final fake = _FakeToggleRepository(hold: true);
      await tester.pumpWidget(_toggleHarness(fake));

      await tester.tap(find.byType(IconButton));
      await tester.pump();
      // Second tap lands while the first request is still open.
      await tester.tap(find.byType(IconButton));
      await tester.pump();

      fake.release();
      await tester.pumpAndSettle();

      // Two racing writes could land out of order and leave the icon
      // disagreeing with the server.
      expect(fake.calls, hasLength(1));
    });
  });

  group('BookmarkIconButton server state', () {
    testWidgets('paints filled when the server says the clinic is saved', (
      tester,
    ) async {
      final fake = _FakeToggleRepository();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [bookmarkToggleRepositoryProvider.overrideWithValue(fake)],
          child: const MaterialApp(
            home: Scaffold(
              body: BookmarkIconButton(
                kind: BookmarkKind.clinic,
                id: 1,
                serverState: true,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // The defect this fixes: before the detail response carried the flag,
      // a saved clinic opened cold showed a hollow icon.
      expect(find.byIcon(Icons.bookmark_rounded), findsOneWidget);
      expect(fake.calls, isEmpty);
    });

    testWidgets('stays hollow while the server answer is unknown', (
      tester,
    ) async {
      final fake = _FakeToggleRepository();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [bookmarkToggleRepositoryProvider.overrideWithValue(fake)],
          child: const MaterialApp(
            home: Scaffold(
              // null = detail request still in flight, which must not be
              // treated as "not saved".
              body: BookmarkIconButton(kind: BookmarkKind.clinic, id: 1),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.bookmark_border_rounded), findsOneWidget);
    });
  });

  group('FavoritosScreen', () {
    testWidgets(
      'shows an empty state per tab, naming the gesture that fills it',
      (tester) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              clinicBookmarksProvider.overrideWith(
                (ref, page) async => _emptyFacilities,
              ),
              doctorBookmarksProvider.overrideWith(
                (ref, page) async => _emptyProfessionals,
              ),
            ],
            child: const MaterialApp(home: FavoritosScreen()),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Clínicas'), findsOneWidget);
        expect(find.text('Médicos'), findsOneWidget);
        expect(
          find.textContaining('Nenhuma clínica salva ainda'),
          findsOneWidget,
        );

        await tester.tap(find.text('Médicos'));
        await tester.pumpAndSettle();
        expect(
          find.textContaining('Nenhum médico salvo ainda'),
          findsOneWidget,
        );
      },
    );

    testWidgets('is a pushed screen: back arrow and title, no nav shell', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            clinicBookmarksProvider.overrideWith(
              (ref, page) async => _emptyFacilities,
            ),
            doctorBookmarksProvider.overrideWith(
              (ref, page) async => _emptyProfessionals,
            ),
          ],
          child: const MaterialApp(home: FavoritosScreen()),
        ),
      );
      await tester.pumpAndSettle();

      // Reached by pushing from Explorar, so it gets a back arrow and its own
      // title — not the top-level nav shell, whose hamburger would imply
      // Favoritos is a destination of its own.
      expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);
      expect(find.text('Favoritos'), findsOneWidget);
      expect(find.byIcon(Icons.menu), findsNothing);
    });

    testWidgets('renders saved clinics and doctors in their tabs', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            clinicBookmarksProvider.overrideWith(
              (ref, page) async => const PaginatedFacilities(
                items: [_clinicDto],
                pagination: Pagination(
                  page: 1,
                  limit: 20,
                  total: 1,
                  totalPages: 1,
                ),
              ),
            ),
            doctorBookmarksProvider.overrideWith(
              (ref, page) async => const PaginatedProfessionals(
                items: [_doctorDto],
                pagination: Pagination(
                  page: 1,
                  limit: 20,
                  total: 1,
                  totalPages: 1,
                ),
              ),
            ),
          ],
          child: const MaterialApp(home: FavoritosScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Clínica Central'), findsOneWidget);

      await tester.tap(find.text('Médicos'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Ana'), findsWidgets);
    });

    testWidgets('offers a retry when the list fails to load', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            clinicBookmarksProvider.overrideWith(
              (ref, page) async => throw const BookmarkException('offline'),
            ),
            doctorBookmarksProvider.overrideWith(
              (ref, page) async => _emptyProfessionals,
            ),
          ],
          child: const MaterialApp(home: FavoritosScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Não foi possível carregar os favoritos'),
        findsOneWidget,
      );
      expect(find.text('Tentar novamente'), findsOneWidget);
    });
  });
}
