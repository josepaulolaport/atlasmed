import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/user_profile.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/preferences.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_assignments.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/user/repositories/user_preferences_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';
import 'package:atlasmed_mobile_app/features/visits/presentation/providers/visit_summary_provider.dart';

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

final territoryStatsProvider = FutureProvider<TerritoryStats>((ref) async {
  // Reactive dependency on weekly summary
  ref.watch(weeklyVisitSummaryProvider);

  // Fetch clinics total
  final clinicsRepo = ClinicsRepository(page: 1, limit: 1);
  ref.onDispose(clinicsRepo.dispose);
  final clinicsResult = await clinicsRepo.currentValueOrResolve();
  final totalClinics = clinicsResult?.pagination.total ?? 0;

  // Fetch doctors total
  final doctorsRepo = DoctorsRepository(page: 1, limit: 1);
  ref.onDispose(doctorsRepo.dispose);
  final doctorsResult = await doctorsRepo.currentValueOrResolve();
  final totalDoctors = doctorsResult?.pagination.total ?? 0;

  // Compute coverage from weekly visit summary
  final summary = await ref.read(weeklyVisitSummaryProvider.future);
  final visitedThisWeek = summary.distinctClinicsVisited;
  final coveragePct = totalClinics > 0
      ? (visitedThisWeek / totalClinics * 100).round().clamp(0, 100)
      : summary.coveragePercentage.round().clamp(0, 100);

  return TerritoryStats(
    clinics: totalClinics,
    doctors: totalDoctors,
    coveragePct: coveragePct,
    visitedThisWeek: visitedThisWeek,
    coverageWeek:
        '${summary.weekStart.day}/${summary.weekStart.month} – ${summary.weekEnd.day}/${summary.weekEnd.month}',
  );
});

final quickSummaryProvider = FutureProvider<List<QuickSummaryItem>>((
  ref,
) async {
  ref.watch(weeklyVisitSummaryProvider);
  final summary = await ref.read(weeklyVisitSummaryProvider.future);
  final visits = summary.distinctClinicsVisited;

  return [
    QuickSummaryItem(
      value: '$visits',
      label: 'Visitas',
      sub: 'esta semana',
      color: 0xFF0a2f7f,
    ),
  ];
});

final preferencesProvider = FutureProvider<List<PreferenceItem>>((ref) async {
  final repo = UserPreferencesRepository();
  ref.onDispose(repo.dispose);
  final prefs = await repo.currentValueOrResolve();

  if (prefs == null) return [];

  return [
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
