import type {
  PurchaseFunnelStage,
  PurchaseIntervalSource,
  PurchaseProfile,
  PurchaseRecurrenceUpdateCommand,
} from "@/types/facility";

export type PurchaseProfileSelection = PurchaseProfile | "AUTOMATIC";
export type PurchaseBadgeVariant =
  | "secondary"
  | "outline"
  | "info"
  | "success"
  | "warning"
  | "destructive";

export const PURCHASE_PROFILE_OPTIONS: Array<{
  value: PurchaseProfileSelection;
  label: string;
  days?: number;
}> = [
  { value: "AUTOMATIC", label: "Automático" },
  { value: "WEEKLY", label: "Semanal", days: 7 },
  { value: "BIWEEKLY", label: "Quinzenal", days: 15 },
  { value: "MONTHLY", label: "Mensal", days: 30 },
  { value: "BIMONTHLY", label: "Bimestral", days: 60 },
  { value: "QUARTERLY", label: "Trimestral", days: 90 },
  { value: "SEMIANNUAL", label: "Semestral", days: 180 },
  { value: "ANNUAL", label: "Anual", days: 365 },
  { value: "CUSTOM", label: "Personalizado" },
];

const FUNNEL_PRESENTATION: Record<
  PurchaseFunnelStage,
  { label: string; variant: PurchaseBadgeVariant }
> = {
  NEVER_PURCHASED: { label: "Nunca comprou", variant: "secondary" },
  OUTSIDE_WINDOW: { label: "Fora do período", variant: "info" },
  PURCHASE_WINDOW: { label: "Período de compra", variant: "success" },
  CHURN: { label: "Risco de churn", variant: "warning" },
  INACTIVE: { label: "Inativo", variant: "destructive" },
};

const SOURCE_LABELS: Record<PurchaseIntervalSource, string> = {
  DEFAULT: "Padrão do sistema",
  CALCULATED: "Calculado pelo histórico",
  MANUAL: "Definido manualmente",
};

export function getPurchaseFunnelStagePresentation(stage: PurchaseFunnelStage) {
  return FUNNEL_PRESENTATION[stage];
}

export function getPurchaseProfileLabel(profile: PurchaseProfile | null): string {
  if (!profile) return "Automático";
  const option = PURCHASE_PROFILE_OPTIONS.find((item) => item.value === profile);
  if (!option) return profile;
  return option.days ? `${option.label} — ${option.days} dias` : option.label;
}

export function getPurchaseSourceLabel(source: PurchaseIntervalSource): string {
  return SOURCE_LABELS[source];
}

export function formatPurchaseDate(value: string | null): string {
  if (!value) return "Nunca comprou";
  const dateOnly = value.slice(0, 10);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00.000Z`));
}

export function getPurchaseRecurrenceCommand(
  selection: PurchaseProfileSelection,
  customInterval: string,
): PurchaseRecurrenceUpdateCommand | null {
  if (selection === "AUTOMATIC") return { mode: "AUTOMATIC" };
  if (selection !== "CUSTOM") return { mode: "PRESET", profile: selection };

  if (!/^\d+$/.test(customInterval.trim())) return null;
  const intervalDays = Number(customInterval);
  if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650) {
    return null;
  }
  return { mode: "CUSTOM", intervalDays };
}

export function getInitialPurchaseProfileSelection(
  profile: PurchaseProfile | null | undefined,
): PurchaseProfileSelection {
  return profile ?? "AUTOMATIC";
}

export function getDefaultPurchaseRecurrence() {
  return {
    observedIntervalDays: null,
    intervalDays: 30,
    source: "DEFAULT" as const,
    profile: null,
    lastPurchaseDate: null,
    sampleSize: 0,
    funnelStage: "NEVER_PURCHASED" as const,
    nextTransitionDate: null,
  };
}

export function purchaseProfileSelectionChanged(
  initial: PurchaseProfileSelection,
  current: PurchaseProfileSelection,
  initialCustomInterval: string,
  currentCustomInterval: string,
): boolean {
  return initial !== current
    || (current === "CUSTOM" && initialCustomInterval !== currentCustomInterval);
}
