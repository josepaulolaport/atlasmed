import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/http_user_repository.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/user_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final userRepositoryProvider = Provider<UserRepository>((ref) {
  return HttpUserRepository();
});

/// Looks up a single user by id — used to resolve a territory's
/// `assignedUserId` into a display name/avatar wherever it's shown.
final userByIdProvider = FutureProvider.family<AppUser?, String>((ref, id) {
  return ref.watch(userRepositoryProvider).getUserById(id);
});
