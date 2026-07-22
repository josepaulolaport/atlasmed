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
  manualPurchaseProfile: PurchaseProfile | null;
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

export type PurchaseRecurrenceValidationErrorCode =
  | "INVALID_DATE"
  | "INVALID_INPUT"
  | "INVALID_MANUAL_INTERVAL"
  | "INVALID_MANUAL_PROFILE";

export class PurchaseRecurrenceValidationError extends Error {
  readonly field: keyof CalculatePurchaseRecurrenceSnapshotInput;
  readonly code: PurchaseRecurrenceValidationErrorCode;
  readonly index?: number;

  constructor(
    field: keyof CalculatePurchaseRecurrenceSnapshotInput,
    code: PurchaseRecurrenceValidationErrorCode,
    message: string,
    index?: number,
  ) {
    super(`${field}${index === undefined ? "" : `[${index}]`}: ${message}`);
    this.name = "PurchaseRecurrenceValidationError";
    this.field = field;
    this.code = code;
    this.index = index;
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
  code: PurchaseRecurrenceValidationErrorCode,
  message: string,
  index?: number,
): never {
  throw new PurchaseRecurrenceValidationError(field, code, message, index);
}

const UTC_CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const RFC3339_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

function normalizeUtcCivilDate(
  value: string,
  field: "purchaseDates" | "today",
  index?: number,
): string {
  if (typeof value !== "string" || value.length === 0) {
    return validationError(
      field,
      "INVALID_DATE",
      "must contain strict ISO date strings",
      index,
    );
  }

  const civilDateMatch = UTC_CIVIL_DATE_PATTERN.exec(value);
  if (civilDateMatch !== null) {
    const year = Number(civilDateMatch[1]);
    const month = Number(civilDateMatch[2]);
    const day = Number(civilDateMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return validationError(
        field,
        "INVALID_DATE",
        `invalid UTC civil date: ${value}`,
        index,
      );
    }

    return value;
  }

  const timestampMatch = RFC3339_TIMESTAMP_PATTERN.exec(value);
  if (timestampMatch === null) {
    return validationError(
      field,
      "INVALID_DATE",
      `expected YYYY-MM-DD or RFC3339 timestamp with explicit timezone: ${value}`,
      index,
    );
  }

  const year = Number(timestampMatch[1]);
  const month = Number(timestampMatch[2]);
  const day = Number(timestampMatch[3]);
  const hour = Number(timestampMatch[4]);
  const minute = Number(timestampMatch[5]);
  const second = Number(timestampMatch[6]);
  const offsetHour = Number(timestampMatch[10] ?? 0);
  const offsetMinute = Number(timestampMatch[11] ?? 0);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return validationError(field, "INVALID_DATE", `invalid timestamp: ${value}`, index);
  }

  const localCivilDate = new Date(Date.UTC(year, month - 1, day));
  if (
    localCivilDate.getUTCFullYear() !== year ||
    localCivilDate.getUTCMonth() !== month - 1 ||
    localCivilDate.getUTCDate() !== day
  ) {
    return validationError(field, "INVALID_DATE", `invalid timestamp: ${value}`, index);
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return validationError(field, "INVALID_DATE", `invalid timestamp: ${value}`, index);
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
  manualPurchaseProfile: PurchaseProfile | null;
  manualPurchaseIntervalDays: number | null;
} {
  const { manualProfile, manualIntervalDays, observedPurchaseIntervalDays } = input;

  if (manualProfile !== null && !PURCHASE_PROFILES.has(manualProfile)) {
    return validationError(
      "manualProfile",
      "INVALID_MANUAL_PROFILE",
      `unsupported profile: ${manualProfile}`,
    );
  }

  if (manualProfile === null) {
    if (manualIntervalDays !== null) {
      return validationError(
        "manualIntervalDays",
        "INVALID_MANUAL_INTERVAL",
        "manualIntervalDays must be null without a manual profile",
      );
    }

    return observedPurchaseIntervalDays === null
      ? {
          purchaseIntervalDays: DEFAULT_INTERVAL_DAYS,
          purchaseIntervalSource: "DEFAULT",
          manualPurchaseProfile: null,
          manualPurchaseIntervalDays: null,
        }
      : {
          purchaseIntervalDays: observedPurchaseIntervalDays,
          purchaseIntervalSource: "CALCULATED",
          manualPurchaseProfile: null,
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
        "INVALID_MANUAL_INTERVAL",
        "CUSTOM requires manualIntervalDays as an integer from 1 to 3650",
      );
    }

    return {
      purchaseIntervalDays: manualIntervalDays,
      purchaseIntervalSource: "MANUAL",
      manualPurchaseProfile: manualProfile,
      manualPurchaseIntervalDays: manualIntervalDays,
    };
  }

  if (manualIntervalDays !== null) {
    return validationError(
      "manualIntervalDays",
      "INVALID_MANUAL_INTERVAL",
      "manualIntervalDays must be null for preset profiles",
    );
  }

  return {
    purchaseIntervalDays: PURCHASE_PROFILE_INTERVAL_DAYS[manualProfile],
    purchaseIntervalSource: "MANUAL",
    manualPurchaseProfile: manualProfile,
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
    return validationError(
      "purchaseDates",
      "INVALID_INPUT",
      "must be an array of date strings",
    );
  }

  const today = normalizeUtcCivilDate(input.today, "today");
  const normalizedPurchaseDates = [
    ...new Set(
      input.purchaseDates.map((purchaseDate, index) =>
        normalizeUtcCivilDate(purchaseDate, "purchaseDates", index),
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
      : Math.round(
          intervals.reduce((sum, interval) => sum + interval, 0) /
            intervals.length,
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
