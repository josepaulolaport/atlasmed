import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
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

void refreshAgenda(Ref ref, AgendaQuery query) {
  ref.invalidate(agendaProvider(query));
  ref.invalidate(agendaAvailabilityProvider(query));
}
