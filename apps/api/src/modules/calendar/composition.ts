import { CreateCalendarEventUseCase, ListCalendarUseCase, GetCalendarAvailabilityUseCase, UpdateCalendarEventUseCase, UpdateCalendarOccurrenceUseCase, CancelCalendarEventUseCase, CancelCalendarOccurrenceUseCase } from "./application/use-cases/calendar.use-cases";
import { DrizzleCalendarRepository } from "./infrastructure/repositories/drizzle/drizzle-calendar.repository";
export const calendarRepositories = { calendar: new DrizzleCalendarRepository() };
export const calendarUseCases = {
  list: () => new ListCalendarUseCase({ repository: calendarRepositories.calendar }),
  availability: () => new GetCalendarAvailabilityUseCase({ repository: calendarRepositories.calendar }),
  create: () => new CreateCalendarEventUseCase({ repository: calendarRepositories.calendar }),
  update: () => new UpdateCalendarEventUseCase({ repository: calendarRepositories.calendar }),
  updateOccurrence: () => new UpdateCalendarOccurrenceUseCase({ repository: calendarRepositories.calendar }),
  cancel: () => new CancelCalendarEventUseCase({ repository: calendarRepositories.calendar }),
  cancelOccurrence: () => new CancelCalendarOccurrenceUseCase({ repository: calendarRepositories.calendar }),
};
