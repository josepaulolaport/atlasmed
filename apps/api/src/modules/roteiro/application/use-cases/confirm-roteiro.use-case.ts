import type { ScopeContext } from "@atlasmed/access";
import { AppError, ForbiddenError, ResourceNotFoundError } from "../../../../shared/errors";
import type { RoteiroRepository, StoredRoteiro } from "../interfaces/roteiro.repository.interface";

export class RoteiroNotDraftError extends AppError {
  constructor(status: string) {
    super("ROTEIRO_NOT_DRAFT", 409, `Roteiro cannot be confirmed from ${status}`, { status });
  }
}

/**
 * The calendar created an event without the interaction that should accompany
 * it. Impossible through `CreateCalendarEventUseCase` with `kind: INTERACTION`,
 * so this exists to fail loudly rather than link a stop to nothing.
 */
export class RoteiroConfirmIncompleteError extends AppError {
  constructor(roteiroId: number, position: number) {
    super(
      "ROTEIRO_CONFIRM_NO_INTERACTION",
      500,
      "Calendar event was created without an interaction",
      { roteiroId, position },
    );
  }
}

/**
 * What confirm needs from the calendar module, as a contract rather than an
 * import of its composition — so this use-case is testable without a database.
 *
 * Deliberately the *existing* `CreateCalendarEventUseCase`: it already takes an
 * owner lock, replays by idempotency key, detects conflicts and creates the
 * calendar row and its interaction together. Reimplementing any of that here
 * would be a second way to create an interaction, and the two would drift.
 */
export interface CalendarEventCreator {
  execute(input: {
    actor: { userId: number; roleName: string };
    scope: ScopeContext;
    idempotencyKey: string;
    data: {
      kind: "INTERACTION";
      title: string;
      facilityId: number;
      modality: "IN_PERSON" | "REMOTE";
      startsAt: string;
      timeZone: string;
      durationMinutes: number;
      recurrence: "NONE";
    };
  }): Promise<{ id: number; interactions?: Array<{ id: number }> }>;
}

export interface ConfirmRoteiroInput {
  roteiroId: number;
  actor: { userId: number; roleName: string };
  scope: ScopeContext;
  timeZone?: string;
  now?: Date;
}

const APP_TIME_ZONE = "America/Sao_Paulo";

export class ConfirmRoteiroUseCase {
  constructor(
    private readonly deps: {
      repository: RoteiroRepository;
      calendar: CalendarEventCreator;
      now?: () => Date;
    },
  ) {}

  async execute(input: ConfirmRoteiroInput): Promise<StoredRoteiro> {
    const roteiro = await this.deps.repository.findById(input.roteiroId);
    if (!roteiro) throw new ResourceNotFoundError("Roteiro", input.roteiroId);

    /**
     * **Only the agent may confirm their own roteiro.**
     *
     * A manager may draft one for their rep (§7.3) but confirming writes to
     * that rep's calendar, and interaction ownership is already owner-only
     * everywhere else. Manager proposes, rep accepts — and an ADMIN is no
     * exception, because there is no such thing as an interaction somebody else
     * performed on your behalf.
     */
    if (roteiro.userId !== input.actor.userId) {
      throw new ForbiddenError("Only the agent may confirm their own roteiro");
    }
    if (roteiro.status === "CONFIRMED") {
      // Idempotent at the top level too: re-confirming returns the same plan
      // rather than a second set of calendar entries.
      return roteiro;
    }
    if (roteiro.status !== "DRAFT") {
      throw new RoteiroNotDraftError(roteiro.status);
    }

    const timeZone = input.timeZone ?? APP_TIME_ZONE;
    const now = input.now ?? this.deps.now?.() ?? new Date();

    for (const stop of roteiro.stops) {
      // A retry after a mid-way conflict replays what already landed rather
      // than duplicating it.
      if (stop.calendarId !== null && stop.interactionId !== null) continue;

      /**
       * Stable across retries, which is what makes a partially-confirmed
       * roteiro safe to re-submit. The version is *not* in the key: bumping it
       * on confirm would make a retry look like a new command and create a
       * second calendar entry for the same stop.
       */
      const idempotencyKey = `roteiro:${roteiro.id}:stop:${stop.position}`;

      // Conflicts propagate as CalendarConflictError → 409 with the clashing
      // occurrences. The rep's calendar is never silently shifted (§7.3).
      const created = await this.deps.calendar.execute({
        actor: input.actor,
        scope: input.scope,
        idempotencyKey,
        data: {
          kind: "INTERACTION",
          title: stop.facilityName,
          facilityId: stop.facilityId,
          modality: stop.modality,
          startsAt: stop.plannedStartsAt.toISOString(),
          timeZone,
          durationMinutes: stop.serviceMinutes,
          recurrence: "NONE",
        },
      });

      const interactionId = created.interactions?.[0]?.id;
      if (interactionId === undefined) {
        throw new RoteiroConfirmIncompleteError(roteiro.id, stop.position);
      }

      await this.deps.repository.linkStop({
        roteiroId: roteiro.id,
        position: stop.position,
        calendarId: created.id,
        interactionId,
      });
    }

    await this.deps.repository.markConfirmed({ roteiroId: roteiro.id, confirmedAt: now });

    const confirmed = await this.deps.repository.findById(roteiro.id);
    if (!confirmed) throw new ResourceNotFoundError("Roteiro", roteiro.id);
    return confirmed;
  }
}
