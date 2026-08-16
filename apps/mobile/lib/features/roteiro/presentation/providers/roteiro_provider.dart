import 'package:atlasmed_mobile_app/features/roteiro/data/repositories/roteiro_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final roteiroRepositoryProvider = Provider<RoteiroRepository>((ref) {
  return RoteiroRepository();
});

/// Why a generation could not start. Distinct from a failed request: the rep
/// can fix these, and the screen tells them how.
///
/// Only reachable for *today* — any other day resolves its origin from the
/// schedule server-side, so there is nothing for the rep to permit (§15.4.1).
enum RoteiroBlocker {
  locationDenied,
  locationDeniedForever,
  locationOff,
  noVertical,
}
