import { DrizzleRoteiroRepository } from "./infrastructure/repositories/drizzle-roteiro.repository";
import { GenerateRoteiroUseCase } from "./application/use-cases/generate-roteiro.use-case";
import {
  ConfirmRoteiroUseCase,
  type CalendarEventCreator,
} from "./application/use-cases/confirm-roteiro.use-case";
import { calendarUseCases } from "../calendar/composition";

const repository = new DrizzleRoteiroRepository();

export const roteiroUseCases = {
  generate: () => new GenerateRoteiroUseCase({ repository }),
  confirm: () =>
    new ConfirmRoteiroUseCase({
      repository,
      // The existing calendar create path, so conflict detection, the owner
      // lock and idempotency are the same ones every other interaction goes
      // through rather than a second implementation.
      calendar: calendarUseCases.create() as unknown as CalendarEventCreator,
    }),
};
