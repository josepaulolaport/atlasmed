import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/core/user/models/user_capabilities.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/repositories/user_capabilities_repository.dart';

final userCapabilitiesRepositoryProvider = Provider<UserCapabilitiesRepository>(
  (ref) {
    return UserCapabilitiesRepository();
  },
);

final userCapabilitiesProvider = Provider<UserCapabilities?>((ref) {
  return ref.watch(userCapabilitiesRepositoryProvider).currentValue;
});

final currentUserRoleProvider = StreamProvider<UserRoleName?>((ref) {
  return ref.watch(userProvider).dataStream.map((user) => user?.role.name);
});
