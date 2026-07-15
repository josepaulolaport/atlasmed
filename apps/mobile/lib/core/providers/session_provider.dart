import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/core/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_assignments_repository.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_preferences_repository.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_repository.dart';

final sessionProvider = Provider<SessionEnvironment>((ref) {
  return SessionEnvironment.instance;
});

final userProvider = Provider<UserRepository>((ref) {
  return UserRepository();
});

final userAssignmentsProvider = Provider<UserAssignmentsRepository>((ref) {
  return UserAssignmentsRepository();
});

final userPreferencesProvider = Provider<UserPreferencesRepository>((ref) {
  return UserPreferencesRepository();
});
