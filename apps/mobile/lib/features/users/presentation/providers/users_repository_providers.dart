import 'package:atlasmed_mobile_app/features/users/data/repositories/invitations_repository.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/mock_invitations_repository.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/mock_users_repository.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Swap these two providers for `Http*` implementations once the mobile
/// user-management screens are wired to the real `/access` API.
final usersRepositoryProvider = Provider<UsersRepository>((ref) {
  return MockUsersRepository();
});

final invitationsRepositoryProvider = Provider<InvitationsRepository>((ref) {
  return MockInvitationsRepository();
});
