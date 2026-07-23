import 'package:atlasmed_mobile_app/features/users/data/repositories/http_invitations_repository.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/http_users_repository.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/invitations_repository.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Live `/access` HTTP repositories for admin Usuários screens.
final usersRepositoryProvider = Provider<UsersRepository>((ref) {
  return HttpUsersRepository();
});

final invitationsRepositoryProvider = Provider<InvitationsRepository>((ref) {
  return HttpInvitationsRepository();
});
