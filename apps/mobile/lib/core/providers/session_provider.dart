import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/data/models/user.dart';
import '../repositories/session_environment.dart';

final sessionProvider = Provider<SessionEnvironment>((ref) {
  return SessionEnvironment.instance;
});

final userProvider = StreamProvider<User?>((ref) {
  final sessionEnvironment = ref.watch(sessionProvider);
  return sessionEnvironment.dataStream.map((session) => session?.user);
});
