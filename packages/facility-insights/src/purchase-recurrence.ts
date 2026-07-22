export type PurchaseIntervalSource = "DEFAULT" | "CALCULATED" | "MANUAL";

export type PurchaseProfile =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "CUSTOM";

export type PurchaseFunnelStage =
  | "NEVER_PURCHASED"
  | "OUTSIDE_WINDOW"
  | "PURCHASE_WINDOW"
  | "CHURN"
  | "INACTIVE";

export const PURCHASE_PROFILE_INTERVAL_DAYS = {
  WEEKLY: 7,
  BIWEEKLY: 15,
  MONTHLY: 30,
  BIMONTHLY: 60,
  QUARTERLY: 90,
  SEMIANNUAL: 180,
  ANNUAL: 365,
} as const satisfies Record<Exclude<PurchaseProfile, "CUSTOM">, number>;

export interface PurchaseRecurrenceSnapshot {
  observedPurchaseIntervalDays: number | null;
  purchaseIntervalDays: number;
  purchaseIntervalSource: PurchaseIntervalSource;
  purchaseProfile: PurchaseProfile | null;
  manualPurchaseIntervalDays: number | null;
  lastValidPurchaseDate: string | null;
  purchaseRecurrenceSampleSize: number;
  purchaseFunnelStage: PurchaseFunnelStage;
  nextPurchaseFunnelTransitionDate: string | null;
}

export interface CalculatePurchaseRecurrenceSnapshotInput {
  purchaseDates: readonly string[];
  manualProfile: PurchaseProfile | null;
  manualIntervalDays: number | null;
  today: string;
}

export class PurchaseRecurrenceValidationError extends Error {
  readonly field: keyof CalculatePurchaseRecurrenceSnapshotInput;

  constructor(
    field: keyof CalculatePurchaseRecurrenceSnapshotInput,
    message: string,
  ) {
    super(`${field}: ${message}`);
    this.name = "PurchaseRecurrenceValidationError";
    this.field = field;
  }
}

const DAY_MILLISECONDS = 86_400_000;
const DEFAULT_INTERVAL_DAYS = 30;
const MIN_CUSTOM_INTERVAL_DAYS = 1;
const MAX_CUSTOM_INTERVAL_DAYS = 3_650;
const MAX_PURCHASE_DATES = 13;
const PURCHASE_PROFILES = new Set<PurchaseProfile>([
  ...Object.keys(PURCHASE_PROFILE_INTERVAL_DAYS) as Array<
    Exclude<PurchaseProfile, "CUSTOM">
  >,
  "CUSTOM",
]);

function validationError(
  field: keyof CalculatePurchaseRecurrenceSnapshotInput,
  message: string,
): never {
  throw new PurchaseRecurrenceValidationError(field, message);
}

function normalizeUtcCivilDate(
  value: string,
  field: "purchaseDates" | "today",
): string {
  if (typeof value !== "string" || value.length === 0) {
    return validationError(field, "must contain valid date strings");
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yearText, monthText, dayText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return validationError(field, `invalid UTC civil date: ${value}`);
    }

    return value;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return validationError(field, `invalid date: ${value}`);
  }

  return date.toISOString().slice(0, 10);
}

function civilDateToEpochDay(value: string): number {
  const [yearText, monthText, dayText] = value.split("-");
  return Math.floor(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)) /
      DAY_MILLISECONDS,
  );
}

function addDays(value: string, days: number): string {
  return new Date(
    (civilDateToEpochDay(value) + days) * DAY_MILLISECONDS,
  )
    .toISOString()
    .slice(0, 10);
}

function resolveEffectiveInterval(input: {
  manualProfile: PurchaseProfile | null;
  manualIntervalDays: number | null;
  observedPurchaseIntervalDays: number | null;
}): {
  purchaseIntervalDays: number;
  purchaseIntervalSource: PurchaseIntervalSource;
  purchaseProfile: PurchaseProfile | null;
  manualPurchaseIntervalDays: number | null;
} {
  const { manualProfile, manualIntervalDays, observedPurchaseIntervalDays } = input;

  if (manualProfile !== null && !PURCHASE_PROFILES.has(manualProfile)) {
    return validationError("manualProfile", `unsupported profile: ${manualProfile}`);
  }

  if (manualProfile === null) {
    if (manualIntervalDays !== null) {
      return validationError(
        "manualIntervalDays",
        "manualIntervalDays must be null without a manual profile",
      );
    }

    return observedPurchaseIntervalDays === null
      ? {
          purchaseIntervalDays: DEFAULT_INTERVAL_DAYS,
          purchaseIntervalSource: "DEFAULT",
          purchaseProfile: null,
          manualPurchaseIntervalDays: null,
        }
      : {
          purchaseIntervalDays: observedPurchaseIntervalDays,
          purchaseIntervalSource: "CALCULATED",
          purchaseProfile: null,
          manualPurchaseIntervalDays: null,
        };
  }

  if (manualProfile === "CUSTOM") {
    if (
      manualIntervalDays === null ||
      !Number.isInteger(manualIntervalDays) ||
      manualIntervalDays < MIN_CUSTOM_INTERVAL_DAYS ||
      manualIntervalDays > MAX_CUSTOM_INTERVAL_DAYS
    ) {
      return validationError(
        "manualIntervalDays",
        "CUSTOM requires manualIntervalDays as an integer from 1 to 3650",
      );
    }

    return {
      purchaseIntervalDays: manualIntervalDays,
      purchaseIntervalSource: "MANUAL",
      purchaseProfile: manualProfile,
      manualPurchaseIntervalDays: manualIntervalDays,
    };
  }

  if (manualIntervalDays !== null) {
    return validationError(
      "manualIntervalDays",
      "manualIntervalDays must be null for preset profiles",
    );
  }

  return {
    purchaseIntervalDays: PURCHASE_PROFILE_INTERVAL_DAYS[manualProfile],
    purchaseIntervalSource: "MANUAL",
    purchaseProfile: manualProfile,
    manualPurchaseIntervalDays: null,
  };
}

function resolveFunnel(input: {
  lastValidPurchaseDate: string | null;
  purchaseIntervalDays: number;
  today: string;
}): {
  purchaseFunnelStage: PurchaseFunnelStage;
  nextPurchaseFunnelTransitionDate: string | null;
} {
  const { lastValidPurchaseDate, purchaseIntervalDays, today } = input;
  if (lastValidPurchaseDate === null) {
    return {
      purchaseFunnelStage: "NEVER_PURCHASED",
      nextPurchaseFunnelTransitionDate: null,
    };
  }

  const ageDays =
    civilDateToEpochDay(today) - civilDateToEpochDay(lastValidPurchaseDate);
  const purchaseWindowStart = Math.ceil(purchaseIntervalDays * 0.5);
  const churnStart = purchaseIntervalDays * 2;
  const inactiveStart = purchaseIntervalDays * 3;

  if (ageDays < purchaseWindowStart) {
    return {
      purchaseFunnelStage: "OUTSIDE_WINDOW",
      nextPurchaseFunnelTransitionDate: addDays(
        lastValidPurchaseDate,
        purchaseWindowStart,
      ),
    };
  }

  if (ageDays < churnStart) {
    return {
      purchaseFunnelStage: "PURCHASE_WINDOW",
      nextPurchaseFunnelTransitionDate: addDays(lastValidPurchaseDate, churnStart),
    };
  }

  if (ageDays < inactiveStart) {
    return {
      purchaseFunnelStage: "CHURN",
      nextPurchaseFunnelTransitionDate: addDays(
        lastValidPurchaseDate,
        inactiveStart,
      ),
    };
  }

  return {
    purchaseFunnelStage: "INACTIVE",
    nextPurchaseFunnelTransitionDate: null,
  };
}

export function calculatePurchaseRecurrenceSnapshot(
  input: CalculatePurchaseRecurrenceSnapshotInput,
): PurchaseRecurrenceSnapshot {
  if (!Array.isArray(input.purchaseDates)) {
    return validationError("purchaseDates", "must be an array of date strings");
  }

  const today = normalizeUtcCivilDate(input.today, "today");
  const normalizedPurchaseDates = [
    ...new Set(
      input.purchaseDates.map((purchaseDate) =>
        normalizeUtcCivilDate(purchaseDate, "purchaseDates"),
      ),
    ),
  ]
    .sort((left, right) => right.localeCompare(left))
    .slice(0, MAX_PURCHASE_DATES);

  const intervals = normalizedPurchaseDates
    .slice(0, -1)
    .map(
      (purchaseDate, index) =>
        civilDateToEpochDay(purchaseDate) -
        civilDateToEpochDay(normalizedPurchaseDates[index + 1]!),
    );
  const observedPurchaseIntervalDays =
    intervals.length === 0
      ? null
      : Math.max(
          1,
          Math.round(
            intervals.reduce((sum, interval) => sum + interval, 0) /
              intervals.length,
          ),
        );
  const effectiveInterval = resolveEffectiveInterval({
    manualProfile: input.manualProfile,
    manualIntervalDays: input.manualIntervalDays,
    observedPurchaseIntervalDays,
  });
  const lastValidPurchaseDate = normalizedPurchaseDates[0] ?? null;
  const funnel = resolveFunnel({
    lastValidPurchaseDate,
    purchaseIntervalDays: effectiveInterval.purchaseIntervalDays,
    today,
  });

  return {
    observedPurchaseIntervalDays,
    ...effectiveInterval,
    lastValidPurchaseDate,
    purchaseRecurrenceSampleSize: intervals.length,
    ...funnel,
  };
}
