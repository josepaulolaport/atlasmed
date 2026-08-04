import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_repository_providers.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AgendaQuery extends Equatable {
  const AgendaQuery({required this.from, required this.to, this.ownerUserId});

  final DateTime from;
  final DateTime to;
  final String? ownerUserId;

  @override
  List<Object?> get props => [from, to, ownerUserId];
}

final calendarRepositoryProvider = Provider<CalendarRepositoryContract>((ref) {
  return CalendarRepository();
});

final calendarMutationRepositoryProvider =
    Provider<CalendarMutationRepositoryContract>((ref) {
      return CalendarRepository();
    });

final agendaProvider = FutureProvider.autoDispose
    .family<List<CalendarOccurrence>, AgendaQuery>((ref, query) {
      return ref
          .watch(calendarRepositoryProvider)
          .listCalendar(
            from: query.from,
            to: query.to,
            ownerUserId: query.ownerUserId,
          );
    });

final agendaAvailabilityProvider = FutureProvider.autoDispose
    .family<List<CalendarAvailabilityInterval>, AgendaQuery>((ref, query) {
      return ref
          .watch(calendarRepositoryProvider)
          .getAvailability(
            from: query.from,
            to: query.to,
            ownerUserId: query.ownerUserId,
          );
    });

final agendaOwnerOptionsProvider = FutureProvider.autoDispose<List<User>>((
  ref,
) async {
  final repository = ref.watch(usersRepositoryProvider);
  final page = await repository.getUsers(
    page: 1,
    limit: 100,
    role: UserRoleName.rep,
  );
  // The current API does not expose manager-to-agent ids on this list DTO.
  // Show users visible in the authenticated scope and let Calendar scope
  // authorization remain the source of truth.
  return page.items;
});

void refreshAgenda(Ref ref, AgendaQuery query) {
  ref.invalidate(agendaProvider(query));
  ref.invalidate(agendaAvailabilityProvider(query));
}
