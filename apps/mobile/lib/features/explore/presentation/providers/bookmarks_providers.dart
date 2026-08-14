import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/bookmarks_repository.dart';

/// Typed to the interface so a test can override it with a plain fake.
final bookmarkToggleRepositoryProvider = Provider<BookmarkToggleApi>((ref) {
  final repository = BookmarkToggleRepository();
  ref.onDispose(repository.dispose);
  return repository;
});

/// Which entities the caller has bookmarked, as known right now.
///
/// Held in memory rather than refetched per card: the detail screens flip it
/// optimistically, and the Favoritos page seeds it from what it loads. A tap
/// therefore renders instantly and every screen showing that clinic agrees,
/// without a request per icon.
///
/// Not persisted. A cold start knows nothing until a screen loads, which is
/// correct — a stale local answer would render a filled icon for a bookmark the
/// server may no longer have.
class BookmarkedIds extends Notifier<Set<String>> {
  @override
  Set<String> build() => <String>{};

  static String keyFor(BookmarkKind kind, int id) => '${kind.name}:$id';

  bool contains(BookmarkKind kind, int id) => state.contains(keyFor(kind, id));

  void set(BookmarkKind kind, int id, {required bool bookmarked}) {
    final key = keyFor(kind, id);
    if (bookmarked) {
      if (state.contains(key)) return;
      state = {...state, key};
    } else {
      if (!state.contains(key)) return;
      state = {...state}..remove(key);
    }
  }

  /// Flips a bookmark optimistically and reverts if the server refuses.
  ///
  /// Lives on the notifier rather than as a free function taking a `ref`:
  /// widgets hold a `WidgetRef` and providers a `Ref`, and threading either
  /// through meant callers picking the right one. The notifier already has the
  /// `ref` it needs.
  ///
  /// Returns the state the UI should end up in; rethrows so the caller can
  /// explain the failure after the icon has already gone back.
  Future<bool> toggle(BookmarkKind kind, int id) async {
    final next = !contains(kind, id);
    set(kind, id, bookmarked: next);
    try {
      await ref
          .read(bookmarkToggleRepositoryProvider)
          .setBookmarked(kind: kind, id: id, bookmarked: next);
      return next;
    } catch (_) {
      // A tap made with no signal is lost, but the user sees it revert rather
      // than believing it saved.
      set(kind, id, bookmarked: !next);
      rethrow;
    }
  }

  /// Seeds from a loaded list — everything on the Favoritos page is bookmarked
  /// by definition.
  void seedAll(BookmarkKind kind, Iterable<int> ids) {
    final additions = ids.map((id) => keyFor(kind, id)).toSet();
    if (additions.every(state.contains)) return;
    state = {...state, ...additions};
  }
}

final bookmarkedIdsProvider = NotifierProvider<BookmarkedIds, Set<String>>(
  BookmarkedIds.new,
);

final clinicBookmarksProvider = FutureProvider.autoDispose
    .family<PaginatedFacilities, int>((ref, page) async {
      final repository = ClinicBookmarksRepository(page: page);
      ref.onDispose(repository.dispose);
      final result = await repository.load();
      ref
          .read(bookmarkedIdsProvider.notifier)
          .seedAll(BookmarkKind.clinic, result.items.map((f) => f.id));
      return result;
    });

final doctorBookmarksProvider = FutureProvider.autoDispose
    .family<PaginatedProfessionals, int>((ref, page) async {
      final repository = DoctorBookmarksRepository(page: page);
      ref.onDispose(repository.dispose);
      final result = await repository.load();
      ref
          .read(bookmarkedIdsProvider.notifier)
          .seedAll(BookmarkKind.doctor, result.items.map((p) => p.id));
      return result;
    });
