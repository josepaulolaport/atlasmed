import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/user_profile.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/preferences.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_assignments.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/user/repositories/user_preferences_repository.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_preferences.dart';
import 'package:atlasmed_mobile_app/shared/widgets/wheel_picker_sheet.dart';

String _regionLabel(UserAssignments? assignments) {
  if (assignments == null) return 'Sem território definido';
  final managers = assignments.managers;
  if (managers.isNotEmpty) {
    return managers.map((m) => m.displayName).join(' · ');
  }
  final territories = assignments.territories;
  if (territories.isNotEmpty) {
    if (territories.length == 1) return territories.first.territoryName;
    return '${territories.length} territórios';
  }
  return 'Sem território definido';
}

// ── Individual data providers ───────────────────────────────
final profileAssignmentsProvider = FutureProvider<UserAssignments?>((
  ref,
) async {
  ref.watch(currentUserProvider);
  final repo = ref.watch(userAssignmentsProvider);
  return repo.currentValueOrResolve();
});

final profileProvider = FutureProvider<UserProfile>((ref) async {
  ref.watch(currentUserProvider);
  final user = await ref.read(currentUserProvider.future);
  if (user == null) {
    throw StateError('Usuário não encontrado');
  }
  final assignments = await ref.watch(profileAssignmentsProvider.future);
  return UserProfile(
    id: user.id,
    displayName: user.displayName,
    initials: _initials(user.displayName),
    role: user.role.name.label,
    region: _regionLabel(assignments),
    email: user.email,
    phone: user.phoneNumber,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    memberSince: user.createdAt,
  );
});

final currentUserProvider = FutureProvider<User?>((ref) async {
  final userRepository = ref.watch(userProvider);
  return userRepository.currentValueOrResolve();
});

final sessionProfileProvider = FutureProvider<UserProfile?>((ref) async {
  final user = await ref.read(currentUserProvider.future);
  if (user == null) return null;
  final assignments = await ref.watch(profileAssignmentsProvider.future);

  return UserProfile(
    id: user.id,
    displayName: user.displayName,
    initials: _initials(user.displayName),
    role: user.role.name.label,
    region: _regionLabel(assignments),
    email: user.email,
    phone: user.phoneNumber,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    memberSince: user.createdAt,
  );
});

String _initials(String name) {
  final parts = name.trim().split(' ');
  if (parts.isEmpty || parts.first.isEmpty) return '';
  if (parts.length >= 2) {
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
  return parts.first[0].toUpperCase();
}

/// Reads back the rep's own hours, naming the linha default where they have
/// none — spec 0016 §15.5.5. "Padrão" rather than a blank, so a rep can tell
/// "nobody asked me" from "somebody set this to eight".
String workingHoursSummary(UserPreferences prefs) {
  final start = prefs.workdayStart;
  final end = prefs.workdayEnd;
  // The lunch break is part of the answer: the engine blocks it out of the day,
  // so a rep reading this row needs to see whether it is reserved at all.
  final lunch = (prefs.lunchMinutes ?? 0) > 0
      ? ' · almoço ${formatDurationLabel(prefs.lunchMinutes!)}'
      : '';
  if (start == null && end == null) {
    return 'Padrão da linha · 08:00–18:00$lunch';
  }
  return '${start ?? "08:00"}–${end ?? "18:00"}'
      '${start == null || end == null ? " (parcial)" : ""}$lunch';
}

/// The rep's stored preferences, so the screen can build rows that need them.
final userPreferencesValueProvider = FutureProvider<UserPreferences?>((
  ref,
) async {
  final repo = UserPreferencesRepository();
  ref.onDispose(repo.dispose);
  return repo.currentValueOrResolve();
});

final preferencesProvider = FutureProvider<List<PreferenceItem>>((ref) async {
  final repo = UserPreferencesRepository();
  ref.onDispose(repo.dispose);
  final prefs = await repo.currentValueOrResolve();

  if (prefs == null) return [];

  return [
    PreferenceItem(
      label: 'Horário de trabalho',
      sub: workingHoursSummary(prefs),
      // onTap is attached by the screen, which has the BuildContext the
      // time picker needs.
    ),
    PreferenceItem(
      label: 'Notificações push',
      sub: prefs.pushNotificationsEnabled ? 'Ativado' : 'Desativado',
      kind: 'toggle',
      value: prefs.pushNotificationsEnabled,
    ),
    PreferenceItem(
      label: 'Notificações por e-mail',
      sub: prefs.emailNotificationsEnabled ? 'Ativado' : 'Desativado',
      kind: 'toggle',
      value: prefs.emailNotificationsEnabled,
    ),
    PreferenceItem(
      label: 'Notificações por SMS',
      sub: prefs.smsNotificationsEnabled ? 'Ativado' : 'Desativado',
      kind: 'toggle',
      value: prefs.smsNotificationsEnabled,
    ),
  ];
});
