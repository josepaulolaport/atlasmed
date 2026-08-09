import 'dart:async';
import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_notes_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_field_notes_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_header_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_potential_section.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemoryCacheStorage extends RepositoryCacheStorage {
  const _MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

const _facility = Facility(id: 1, name: 'Clínica Central');

void main() {
  setUpAll(() async {
    BaseRepository.storage = const _MemoryCacheStorage();
    await BaseRepository.storage.write(
      key: '${AppConfig.apiBaseUrl}/api/v1/session/',
      value: jsonEncode({
        'session': {'token': 'test-token', 'refreshToken': 'test-refresh'},
      }),
    );
    // ignore: invalid_use_of_protected_member — test-only reset to avoid leaking a pending Timer across tests.
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
  testWidgets('header renders identity for a loaded facility', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ClinicHeaderSection(
              detail: _facility,
              sections: null,
              photos: null,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Clínica Central'), findsOneWidget);
  });

  testWidgets('field notes shows loading indicator while notes resolve', (
    tester,
  ) async {
    final notesLoading = Completer<List<FacilityFieldNote>>();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          facilityNotesProvider(1).overrideWith((ref) => notesLoading.future),
        ],
        child: const MaterialApp(
          home: Scaffold(body: ClinicFieldNotesSection(facilityId: 1)),
        ),
      ),
    );

    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    notesLoading.complete(const []);
  });

  testWidgets('potential prompts for linha selection before loading data', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ClinicPotentialSection(facilityId: 1, canEdit: true),
          ),
        ),
      ),
    );

    expect(find.text('Potencial & share'), findsOneWidget);
    expect(
      find.text('Selecione uma linha comercial para ver o potencial.'),
      findsOneWidget,
    );
  });
}
