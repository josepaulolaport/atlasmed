import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/associate_doctors_sheet.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Ending a doctor's affiliation from the associate sheet.
///
/// Un-ticking an already-linked doctor showed a snackbar reading "removido" and
/// then did nothing: `_confirm` had no removal branch, and its guard returned
/// early unless something was ticked. With one doctor at the clinic, un-ticking
/// them emptied the selection, which also disabled the save button — so the
/// removal could not even be attempted. The rep was told it had happened, and
/// the database never heard about it.

class RecordingClient extends RepositoryHttpClient {
  RecordingClient(this.handler);

  final RepositoryHttpResponse Function(RepositoryHttpRequest) handler;
  final List<RepositoryHttpRequest> requests = [];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requests.add(request);
    return handler(request);
  }

  List<RepositoryHttpRequest> get deletes => requests
      .where((r) => r.method == RepositoryHttpMethod.delete)
      .toList(growable: false);

  List<RepositoryHttpRequest> get posts => requests
      .where((r) => r.method == RepositoryHttpMethod.post)
      .toList(growable: false);
}

class MemoryCacheStorage extends RepositoryCacheStorage {
  const MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

RepositoryHttpResponse jsonResponse(Object body, {int statusCode = 200}) =>
    RepositoryHttpResponse(
      statusCode: statusCode,
      headers: const {},
      body: jsonEncode(body),
    );

ProfessionalRoster linked({
  int id = 11,
  int personFacilityId = 1828,
  String name = 'Leonardo de Figueiredo',
}) {
  return ProfessionalRoster(
    id: id,
    personFacilityId: personFacilityId,
    name: name,
    initials: initialsFromName(name),
    hue: hueFromName(name),
  );
}

Future<List<ProfessionalRoster>?> pumpSheet(
  WidgetTester tester, {
  required RecordingClient client,
  required List<ProfessionalRoster> associated,
}) async {
  List<ProfessionalRoster>? result;
  var popped = false;

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => AssociateDoctorsSheet(
            alreadyAssociatedIds: associated.map((d) => d.id).toSet(),
            alreadyAssociatedDoctors: associated,
            facilityId: 9,
            repositoryBuilder: (facilityId) =>
                FacilityAssociateRepository(facilityId, client: client),
          ),
        ),
      ),
      // Captures what the sheet pops without a modal route.
      navigatorObservers: [
        _PopObserver((value) {
          if (popped) return;
          popped = true;
          result = value as List<ProfessionalRoster>?;
        }),
      ],
    ),
  );
  await tester.pumpAndSettle();
  return result;
}

class _PopObserver extends NavigatorObserver {
  _PopObserver(this.onPop);
  final void Function(Object?) onPop;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  BaseRepository.storage = const MemoryCacheStorage();
  BaseRepository.autoRefreshEnabled = false;

  RepositoryHttpResponse handler(RepositoryHttpRequest request) {
    final path = request.url.path;
    if (path.endsWith('/cnes-suggestions')) {
      return jsonResponse({
        'status': 'OK',
        'reference': '2026-07',
        'items': const [],
      });
    }
    if (path.contains('/healthcare-professionals')) {
      return jsonResponse({'data': const [], 'pagination': const {}});
    }
    return jsonResponse(const {});
  }

  testWidgets('the save button stays live after un-ticking the only doctor', (
    tester,
  ) async {
    // The bug: with nothing ticked the button was disabled, so there was no way
    // to commit the removal the sheet had just announced.
    final client = RecordingClient(handler);
    await pumpSheet(tester, client: client, associated: [linked()]);

    expect(find.text('Associar (1)'), findsNothing);
    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();

    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNotNull);
  });

  testWidgets('the button says what it is about to do', (tester) async {
    final client = RecordingClient(handler);
    await pumpSheet(tester, client: client, associated: [linked()]);

    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();

    // "Associar" is the wrong promise for a save that only removes.
    expect(find.text('Remover (1)'), findsOneWidget);
  });

  testWidgets('a removal-only save is coloured as the destructive act it is', (
    tester,
  ) async {
    final client = RecordingClient(handler);
    await pumpSheet(tester, client: client, associated: [linked()]);

    // Before: nothing staged, so the button is the ordinary primary action.
    FilledButton button() =>
        tester.widget<FilledButton>(find.byType(FilledButton));
    Color? background(FilledButton widget) =>
        widget.style?.backgroundColor?.resolve(const <WidgetState>{});

    expect(background(button()), AppColors.navyBright);

    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();

    expect(
      background(button()),
      AppColors.red,
      reason:
          'a button reading "Remover" in the primary navy says nothing '
          'about which of associate/remove is about to happen',
    );
  });

  testWidgets('saving ends the affiliation on the server', (tester) async {
    final client = RecordingClient(handler);
    await pumpSheet(tester, client: client, associated: [linked()]);

    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();

    // One DELETE, addressed by personFacilityId — the id the endpoint takes.
    expect(client.deletes, hasLength(1));
    expect(client.deletes.single.url.path, endsWith('/1828'));
    // And nothing was associated on the way past.
    expect(client.posts, isEmpty);
  });

  testWidgets('a doctor left ticked is not removed', (tester) async {
    // The removal set is "linked when the sheet opened, not ticked now" — a
    // set built the other way round would end every affiliation on screen.
    final client = RecordingClient(handler);
    await pumpSheet(
      tester,
      client: client,
      associated: [
        linked(id: 11, personFacilityId: 1828, name: 'Ana Prescritora'),
        linked(id: 12, personFacilityId: 1829, name: 'Bruno Cirurgião'),
      ],
    );

    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();

    expect(client.deletes, hasLength(1));
    expect(client.deletes.single.url.path, endsWith('/1828'));
  });

  testWidgets('un-ticking stages the removal without announcing it', (
    tester,
  ) async {
    // There used to be a four-second "removido" snackbar here that never went
    // away — it announced a removal that had not happened yet, and then sat
    // over the sheet. The row and the footer button carry that state instead.
    final client = RecordingClient(handler);
    await pumpSheet(tester, client: client, associated: [linked()]);

    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();

    expect(find.byType(SnackBar), findsNothing);
    expect(find.text('Remover (1)'), findsOneWidget);
  });

  testWidgets('re-ticking is the undo', (tester) async {
    final client = RecordingClient(handler);
    await pumpSheet(tester, client: client, associated: [linked()]);

    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();

    expect(find.text('Associar'), findsOneWidget);
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
    expect(client.deletes, isEmpty);
  });

  testWidgets('changing nothing sends nothing', (tester) async {
    final client = RecordingClient(handler);
    await pumpSheet(tester, client: client, associated: [linked()]);

    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();

    expect(client.deletes, isEmpty);
    expect(client.posts, isEmpty);
  });

  testWidgets('a failed removal says so and leaves the sheet open', (
    tester,
  ) async {
    // The rep has to be able to see it did not work; a sheet that closed on
    // failure would look exactly like one that succeeded.
    final client = RecordingClient((request) {
      if (request.method == RepositoryHttpMethod.delete) {
        return jsonResponse({'message': 'Sem permissão'}, statusCode: 403);
      }
      return handler(request);
    });
    await pumpSheet(tester, client: client, associated: [linked()]);

    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton));
    // Pumped rather than settled: the snackbar carries a dismissal timer, and
    // settling waits it out and then finds nothing.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.byType(AssociateDoctorsSheet), findsOneWidget);
    expect(find.byType(SnackBar), findsOneWidget);
    expect(find.textContaining('Falha'), findsOneWidget);
    await tester.pumpAndSettle();
  });
}
