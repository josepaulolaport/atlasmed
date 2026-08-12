import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// The clinic's linhas are known at tap time, so the potential card must not
/// wait for a round trip to learn them.
///
/// Before this, `clinicDetailKnownProfileIdsProvider` was filled only from the
/// detail *response*, in a post-frame callback. The active linha stayed null
/// until then, and the potential card needs a verticalId to ask for anything —
/// so it could not begin loading until the rest of the page had already painted.
/// Every list and map entry carries `verticalProfiles`, so that round trip was
/// buying an answer the client already had.
void main() {
  // Resolving the linha reaches providers that lazily build the
  // SessionEnvironment singleton, which starts a periodic refresh timer. Same
  // reset the other repository-backed tests use, so the timer is not charged to
  // whichever test happens to run first.
  setUpAll(() {
    // ignore: invalid_use_of_protected_member
    SessionEnvironment.instance.timer?.cancel();
    // ignore: invalid_use_of_protected_member
    SessionEnvironment.instance.timer = null;
  });

  tearDown(() {
    // ignore: invalid_use_of_protected_member
    SessionEnvironment.instance.timer?.cancel();
    // ignore: invalid_use_of_protected_member
    SessionEnvironment.instance.timer = null;
  });

  FacilityEntry entry({required List<int> verticalIds}) => FacilityEntry(
    id: 42,
    name: 'Clínica Teste',
    city: 'São Paulo',
    doctorCount: 0,
    verticalProfiles: [
      for (final id in verticalIds)
        FacilityVerticalProfileDTO(verticalId: id, verticalName: 'Linha $id'),
    ],
  );

  /// The user's linhas. An app-lifetime `FutureProvider`, loaded once for the
  /// Explorar filter chips, so it is warm long before a clinic is tapped —
  /// resolution depends on it, and overriding it here is what makes this test
  /// the realistic case rather than a cold start.
  List<Override> withUserLinhas(List<int> ids) => [
    currentUserFacilityVerticalOptionsProvider.overrideWith(
      (ref) async => [
        for (final id in ids)
          BusinessVertical(id: id, slug: '', name: 'Linha \$id'),
      ],
    ),
  ];

  /// Gives us a WidgetRef, which the seed helpers take.
  Future<WidgetRef> refFor(
    WidgetTester tester,
    ProviderContainer container,
  ) async {
    late WidgetRef captured;
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: Consumer(
          builder: (context, ref, _) {
            captured = ref;
            return const SizedBox.shrink();
          },
        ),
      ),
    );
    return captured;
  }

  testWidgets('a single-linha clinic resolves its linha at navigation time', (
    tester,
  ) async {
    final container = ProviderContainer(overrides: withUserLinhas([7, 9]));
    addTearDown(container.dispose);
    final ref = await refFor(tester, container);
    await container.read(currentUserFacilityVerticalOptionsProvider.future);
    await tester.pump();

    // No clinic request has been made — this is the moment of the tap.
    expect(container.read(clinicDetailActiveLinhaIdProvider(42)), isNull);

    seedClinicDetailShellFromEntry(ref, entry(verticalIds: [7]));

    // Resolved with no request having been made, so the potential card can ask
    // for its data in parallel with the facility detail rather than after it.
    expect(container.read(clinicDetailKnownProfileIdsProvider(42)), {7});
    expect(container.read(clinicDetailActiveLinhaIdProvider(42)), 7);
  });

  testWidgets(
    'a clinic with no linhas seeds nothing rather than an empty set',
    (tester) async {
      // An empty set is indistinguishable from "not yet known", and writing one
      // would claim the clinic has no linhas on the word of a list row.
      final container = ProviderContainer(overrides: withUserLinhas([7]));
      addTearDown(container.dispose);
      final ref = await refFor(tester, container);
      await container.read(currentUserFacilityVerticalOptionsProvider.future);

      seedClinicDetailShellFromEntry(ref, entry(verticalIds: const []));

      expect(container.read(clinicDetailKnownProfileIdsProvider(42)), isEmpty);
      expect(container.read(clinicDetailActiveLinhaIdProvider(42)), isNull);
    },
  );

  testWidgets('ids the list could not resolve are not treated as linhas', (
    tester,
  ) async {
    // A zero id is the API's "unknown", not a linha.
    final container = ProviderContainer(overrides: withUserLinhas([7]));
    addTearDown(container.dispose);
    final ref = await refFor(tester, container);
    await container.read(currentUserFacilityVerticalOptionsProvider.future);

    seedClinicDetailShellFromEntry(ref, entry(verticalIds: [0, 7]));

    expect(container.read(clinicDetailKnownProfileIdsProvider(42)), {7});
  });
}
