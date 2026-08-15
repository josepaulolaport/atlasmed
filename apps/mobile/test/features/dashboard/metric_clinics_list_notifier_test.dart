import 'dart:async';

import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:flutter_test/flutter_test.dart';

/// Paging and searching inside a metric breakdown.
///
/// Asserted on the notifier rather than through the list widget: appending,
/// the re-entrancy guard and the stale-response drop are all invisible from
/// outside — the rendered list looks the same whether the second page was
/// appended once or twice — and driving them through a fling makes the test
/// about scroll physics instead.

DashboardClinicPage pageOf({
  required int page,
  required int total,
  int limit = 25,
}) {
  final first = (page - 1) * limit + 1;
  final count = first + limit - 1 > total ? total - first + 1 : limit;
  return DashboardClinicPage(
    data: [
      for (var i = 0; i < count; i++)
        FacilityEntry(
          id: first + i,
          name: 'Clínica ${first + i}',
          city: 'Niterói',
          doctorCount: 1,
        ),
    ],
    total: total,
    page: page,
    limit: limit,
  );
}

class Recorder {
  final calls = <({int page, String? search})>[];
  final holds = <int, Completer<DashboardClinicPage?>>{};
  int total = 60;
  int matches = 2;

  Future<DashboardClinicPage?> fetch({
    required String metric,
    required DashboardScopeArgs scope,
    required int page,
    required int limit,
    String? search,
  }) {
    calls.add((page: page, search: search));
    final hold = holds[page];
    if (hold != null) return hold.future;
    final narrowed = search != null && search.trim().isNotEmpty;
    return Future.value(pageOf(page: page, total: narrowed ? matches : total));
  }
}

MetricClinicsListNotifier notifierFor(Recorder recorder) {
  return MetricClinicsListNotifier(
    metric: 'assigned-clinics',
    scope: const DashboardScopeArgs(verticalId: 1),
    fetch: recorder.fetch,
  );
}

void main() {
  group('paging', () {
    test('the first page lands and stops the loading state', () async {
      final recorder = Recorder();
      final notifier = notifierFor(recorder);
      await pumpEventQueue();

      expect(notifier.state.loading, isFalse);
      expect(notifier.state.clinics, hasLength(25));
      expect(notifier.state.total, 60);
      expect(notifier.state.hasMore, isTrue);
    });

    test('loadMore appends rather than replacing', () async {
      final recorder = Recorder();
      final notifier = notifierFor(recorder);
      await pumpEventQueue();

      await notifier.loadMore();

      expect(notifier.state.clinics, hasLength(50));
      // Page one is still at the top; this is one list, not two pages.
      expect(notifier.state.clinics.first.name, 'Clínica 1');
      expect(notifier.state.clinics[25].name, 'Clínica 26');
    });

    test('a second call while one is in flight is dropped', () async {
      // The scroll-end fires repeatedly near the bottom. Unguarded, page two
      // is fetched twice and every one of its clinics appears twice.
      final recorder = Recorder();
      recorder.holds[2] = Completer<DashboardClinicPage?>();
      final notifier = notifierFor(recorder);
      await pumpEventQueue();

      unawaited(notifier.loadMore());
      unawaited(notifier.loadMore());
      unawaited(notifier.loadMore());
      await pumpEventQueue();

      expect(recorder.calls.where((call) => call.page == 2), hasLength(1));

      recorder.holds[2]!.complete(pageOf(page: 2, total: 60));
      await pumpEventQueue();
      expect(notifier.state.clinics, hasLength(50));
    });

    test('stops at the end rather than asking for a page past it', () async {
      final recorder = Recorder()..total = 20;
      final notifier = notifierFor(recorder);
      await pumpEventQueue();

      expect(notifier.state.hasMore, isFalse);
      await notifier.loadMore();

      expect(recorder.calls.map((call) => call.page), [1]);
    });
  });

  group('search', () {
    test('starts the list over instead of appending to it', () async {
      final recorder = Recorder();
      final notifier = notifierFor(recorder);
      await pumpEventQueue();
      await notifier.loadMore();
      expect(notifier.state.clinics, hasLength(50));

      notifier.setQuery('joelho');
      await Future<void>.delayed(const Duration(milliseconds: 350));
      await pumpEventQueue();

      // Page two of the old query must not survive into the new one.
      expect(notifier.state.clinics, hasLength(2));
      expect(notifier.state.total, 2);
      expect(recorder.calls.last, (page: 1, search: 'joelho'));
    });

    test('one request for a burst of keystrokes', () async {
      final recorder = Recorder();
      final notifier = notifierFor(recorder);
      await pumpEventQueue();
      final before = recorder.calls.length;

      for (final value in ['j', 'jo', 'joe', 'joel']) {
        notifier.setQuery(value);
        await Future<void>.delayed(const Duration(milliseconds: 40));
      }
      await Future<void>.delayed(const Duration(milliseconds: 350));
      await pumpEventQueue();

      expect(recorder.calls.length - before, 1);
      expect(recorder.calls.last.search, 'joel');
    });

    test('a slow answer to an old query never overwrites a newer one', () async {
      // Type "a", it hangs; type "b", it answers; then "a" comes back. Without
      // the guard the list settles on whichever the server finished last.
      final recorder = Recorder();
      final notifier = notifierFor(recorder);
      await pumpEventQueue();

      recorder.holds[1] = Completer<DashboardClinicPage?>();
      notifier.setQuery('antigo');
      await Future<void>.delayed(const Duration(milliseconds: 350));
      await pumpEventQueue();

      recorder.holds.remove(1);
      recorder.matches = 7;
      notifier.setQuery('novo');
      await Future<void>.delayed(const Duration(milliseconds: 350));
      await pumpEventQueue();
      expect(notifier.state.total, 7);

      // The stale one finally lands.
      recorder.holds[1] ??= Completer<DashboardClinicPage?>();
      await pumpEventQueue();

      expect(notifier.state.query, 'novo');
      expect(notifier.state.total, 7);
    });

    test('clearing the box asks for the whole recorte again', () async {
      final recorder = Recorder();
      final notifier = notifierFor(recorder);
      await pumpEventQueue();

      notifier.setQuery('joelho');
      await Future<void>.delayed(const Duration(milliseconds: 350));
      await pumpEventQueue();
      expect(notifier.state.total, 2);

      notifier.setQuery('');
      await Future<void>.delayed(const Duration(milliseconds: 350));
      await pumpEventQueue();

      expect(notifier.state.total, 60);
      expect(recorder.calls.last, (page: 1, search: ''));
    });
  });
}
