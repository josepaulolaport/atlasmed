import { ForbiddenError } from "../../../../shared/errors";
import type {
  RoteiroRejectionReason,
  RoteiroRepository,
} from "../interfaces/roteiro.repository.interface";

/**
 * How many times a rep must have turned a clinic down before we ask them why.
 *
 * One removal is a shrug. It means "not now" as often as "not here" — the same
 * tap carries both, and a rep dropping a good clinic because Monday is a bad
 * drive is telling us about their calendar, not about the clinic. Asking on
 * every removal buys worse data, not more: the sheet becomes something to
 * dismiss. The second time is when the question is earned.
 */
const ASK_REASON_AFTER = 1;

export interface RejectStopInput {
  actor: { userId: number };
  /** Whose slate. A manager drafting for a rep does not get to speak for them. */
  subjectUserId?: number;
  verticalId: number;
  facilityVerticalProfileId: number;
  roteiroId?: number | null;
  position?: number | null;
  replacedByProfileId?: number | null;
}

export interface RejectStopResult {
  rejectionId: number;
  /** Whether the client should now ask the rep why. */
  shouldAskReason: boolean;
}

export class RejectStopUseCase {
  constructor(private readonly deps: { repository: RoteiroRepository }) {}

  async execute(input: RejectStopInput): Promise<RejectStopResult> {
    const subjectUserId = input.subjectUserId ?? input.actor.userId;
    if (subjectUserId !== input.actor.userId) {
      // A rejection is a statement. A manager may draft a day for a rep, but
      // "I do not want this clinic" is not theirs to say on the rep's behalf.
      throw new ForbiddenError("Só o próprio representante pode recusar uma sugestão.");
    }

    const { id, priorCount } = await this.deps.repository.recordRejection({
      userId: subjectUserId,
      verticalId: input.verticalId,
      facilityVerticalProfileId: input.facilityVerticalProfileId,
      roteiroId: input.roteiroId ?? null,
      position: input.position ?? null,
      replacedByProfileId: input.replacedByProfileId ?? null,
    });

    return { rejectionId: id, shouldAskReason: priorCount >= ASK_REASON_AFTER };
  }
}

export interface ExplainRejectionInput {
  actor: { userId: number };
  rejectionId: number;
  reason: RoteiroRejectionReason;
  note?: string | null;
}

export class ExplainRejectionUseCase {
  constructor(private readonly deps: { repository: RoteiroRepository }) {}

  async execute(input: ExplainRejectionInput): Promise<void> {
    await this.deps.repository.setRejectionReason({
      rejectionId: input.rejectionId,
      userId: input.actor.userId,
      reason: input.reason,
      note: input.note ?? null,
    });
  }
}
