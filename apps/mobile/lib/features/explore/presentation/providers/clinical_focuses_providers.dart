import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinical_focuses_repository.dart';

/// Clinical focus catalog for Explorar clinic filters (kept alive for chip labels).
final clinicalFocusesRepositoryProvider = Provider<ClinicalFocusesRepository>((
  ref,
) {
  final repository = ClinicalFocusesRepository();
  ref.onDispose(repository.dispose);
  return repository;
});
