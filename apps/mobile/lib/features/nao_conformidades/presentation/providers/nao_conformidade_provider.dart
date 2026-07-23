import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/repositories/field_suggestions_repository.dart';

final fieldSuggestionsRepositoryProvider = Provider<FieldSuggestionsRepository>(
  (ref) => FieldSuggestionsRepository(),
);

/// Local cache so detail screens (esp. REP mine view without ops GET) work.
class NaoConformidadeCacheNotifier
    extends StateNotifier<Map<String, NaoConformidadeSuggestion>> {
  NaoConformidadeCacheNotifier() : super(const {});

  void upsert(NaoConformidadeSuggestion suggestion) {
    state = {...state, suggestion.id: suggestion};
  }

  void upsertAll(Iterable<NaoConformidadeSuggestion> items) {
    if (items.isEmpty) return;
    state = {...state, for (final item in items) item.id: item};
  }

  NaoConformidadeSuggestion? byId(String id) => state[id];
}

final naoConformidadeCacheProvider =
    StateNotifierProvider<
      NaoConformidadeCacheNotifier,
      Map<String, NaoConformidadeSuggestion>
    >((ref) => NaoConformidadeCacheNotifier());

/// Ops queue — `status` is API value: PENDING | APPROVED | REJECTED | ALL.
final opsNaoConformidadesProvider = FutureProvider.autoDispose
    .family<List<NaoConformidadeSuggestion>, String>((ref, status) async {
      final repo = ref.watch(fieldSuggestionsRepositoryProvider);
      final items = await repo.listOps(status: status);
      ref.read(naoConformidadeCacheProvider.notifier).upsertAll(items);
      return items;
    });

/// Current user's suggestions for one clinic.
final mySuggestionsForClinicProvider = FutureProvider.autoDispose
    .family<List<NaoConformidadeSuggestion>, String>((ref, clinicId) async {
      final repo = ref.watch(fieldSuggestionsRepositoryProvider);
      final items = await repo.listMineForFacility(facilityId: clinicId);
      ref.read(naoConformidadeCacheProvider.notifier).upsertAll(items);
      return items;
    });

/// Detail lookup: cache first, then ops GET when missing.
final naoConformidadeByIdProvider = FutureProvider.autoDispose
    .family<NaoConformidadeSuggestion?, String>((ref, id) async {
      final cached = ref.watch(naoConformidadeCacheProvider)[id];
      if (cached != null) return cached;

      try {
        final repo = ref.watch(fieldSuggestionsRepositoryProvider);
        final item = await repo.getById(id);
        ref.read(naoConformidadeCacheProvider.notifier).upsert(item);
        return item;
      } on FieldSuggestionsException {
        return null;
      }
    });

/// Submit / review actions that refresh list providers.
class NaoConformidadeActions {
  NaoConformidadeActions(this._ref);

  final Ref _ref;

  FieldSuggestionsRepository get _repo =>
      _ref.read(fieldSuggestionsRepositoryProvider);

  Future<NaoConformidadeSuggestion> submitFieldChange({
    required String facilityId,
    required String fieldKey,
    required Object proposedValue,
    String? reason,
  }) async {
    final created = await _repo.createFieldChange(
      facilityId: facilityId,
      fieldKey: fieldKey,
      proposedValue: proposedValue,
      reason: reason,
    );
    _ref.read(naoConformidadeCacheProvider.notifier).upsert(created);
    _ref.invalidate(mySuggestionsForClinicProvider(facilityId));
    _ref.invalidate(opsNaoConformidadesProvider);
    return created;
  }

  Future<NaoConformidadeSuggestion> submitDeactivation({
    required String facilityId,
    required String reason,
  }) async {
    final created = await _repo.createDeactivation(
      facilityId: facilityId,
      reason: reason,
    );
    _ref.read(naoConformidadeCacheProvider.notifier).upsert(created);
    _ref.invalidate(mySuggestionsForClinicProvider(facilityId));
    _ref.invalidate(opsNaoConformidadesProvider);
    return created;
  }

  Future<NaoConformidadeSuggestion> accept(String id) async {
    final updated = await _repo.approve(id);
    _ref.read(naoConformidadeCacheProvider.notifier).upsert(updated);
    _ref.invalidate(opsNaoConformidadesProvider);
    _ref.invalidate(naoConformidadeByIdProvider(id));
    if (updated.targetId.isNotEmpty) {
      _ref.invalidate(mySuggestionsForClinicProvider(updated.targetId));
      // Facility was mutated on approve — refresh open/cached clinic detail.
      final facilityId = updated.targetId;
      _ref.invalidate(clinicDetailProvider(facilityId));
      // Warm the provider so popping back to the clinic already has fresh data.
      // ignore: unused_result
      _ref.read(clinicDetailProvider(facilityId).future);
    }
    return updated;
  }

  Future<NaoConformidadeSuggestion> reject(
    String id, {
    required String note,
  }) async {
    final updated = await _repo.reject(id, resolutionNote: note);
    _ref.read(naoConformidadeCacheProvider.notifier).upsert(updated);
    _ref.invalidate(opsNaoConformidadesProvider);
    _ref.invalidate(naoConformidadeByIdProvider(id));
    if (updated.targetId.isNotEmpty) {
      _ref.invalidate(mySuggestionsForClinicProvider(updated.targetId));
    }
    return updated;
  }
}

final naoConformidadeActionsProvider = Provider<NaoConformidadeActions>((ref) {
  return NaoConformidadeActions(ref);
});
