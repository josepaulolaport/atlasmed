import { DrizzleRoteiroRepository } from "./infrastructure/repositories/drizzle-roteiro.repository";
import {
  GenerateRoteiroUseCase,
  type ScheduleReader,
} from "./application/use-cases/generate-roteiro.use-case";
import {
  ConfirmRoteiroUseCase,
  type CalendarEventCreator,
} from "./application/use-cases/confirm-roteiro.use-case";
import { calendarUseCases } from "../calendar/composition";
import { MapboxTravelTimeSource } from "./infrastructure/adapters/mapbox-travel.adapter";

const repository = new DrizzleRoteiroRepository();

export const roteiroUseCases = {
  generate: () =>
    new GenerateRoteiroUseCase({
      repository,
      // The agent's own schedule, read rather than asked for. `list` rather
      // than `availability` because the roteiro needs to know *where* a booked
      // visit is, not only that the hour is taken — that is what lets it plan
      // clinics on the way to something already committed.
      schedule: calendarUseCases.list() as unknown as ScheduleReader,
      // Real drive times when Mapbox is configured and reachable; the engine
      // falls back to estimates and labels them when it is not.
      travel: new MapboxTravelTimeSource(),
    }),
  confirm: () =>
    new ConfirmRoteiroUseCase({
      repository,
      // The existing calendar create path, so conflict detection, the owner
      // lock and idempotency are the same ones every other interaction goes
      // through rather than a second implementation.
      calendar: calendarUseCases.create() as unknown as CalendarEventCreator,
    }),
};
