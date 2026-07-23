"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PurchaseRecurrence } from "@/types/facility";
import {
  getPurchaseSourceLabel,
  PURCHASE_PROFILE_OPTIONS,
  type PurchaseProfileSelection,
} from "./purchase-recurrence";

interface FacilityPurchaseProfileFieldsProps {
  value: PurchaseProfileSelection;
  customInterval: string;
  onValueChange: (value: PurchaseProfileSelection) => void;
  onCustomIntervalChange: (value: string) => void;
  recurrence?: PurchaseRecurrence;
  disabled?: boolean;
}

export function FacilityPurchaseProfileFields({
  value,
  customInterval,
  onValueChange,
  onCustomIntervalChange,
  recurrence,
  disabled,
}: FacilityPurchaseProfileFieldsProps) {
  const customIsValid = value !== "CUSTOM"
    || (/^\d+$/.test(customInterval.trim())
      && Number(customInterval) >= 1
      && Number(customInterval) <= 3650);

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-900">Perfil de compras</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Use o histórico automaticamente ou defina uma recorrência manual para esta unidade.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="facility-purchase-profile">Perfil</Label>
        <Select
          value={value}
          onValueChange={(next) => onValueChange(next as PurchaseProfileSelection)}
          disabled={disabled}
        >
          <SelectTrigger id="facility-purchase-profile" aria-label="Perfil de compras">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PURCHASE_PROFILE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.days ? `${option.label} — ${option.days} dias` : option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value === "CUSTOM" && (
        <div className="space-y-1.5">
          <Label htmlFor="facility-purchase-custom-interval">Intervalo personalizado</Label>
          <div className="flex items-center gap-2">
            <Input
              id="facility-purchase-custom-interval"
              type="number"
              min={1}
              max={3650}
              step={1}
              inputMode="numeric"
              value={customInterval}
              onChange={(event) => onCustomIntervalChange(event.target.value)}
              aria-invalid={!customIsValid}
              aria-describedby="facility-purchase-custom-help"
              disabled={disabled}
            />
            <span className="text-sm text-zinc-600">dias</span>
          </div>
          <p
            id="facility-purchase-custom-help"
            className={customIsValid ? "text-xs text-zinc-500" : "text-xs text-red-600"}
          >
            {customIsValid
              ? "Informe um número inteiro entre 1 e 3.650 dias."
              : "O intervalo deve ser um número inteiro entre 1 e 3.650 dias."}
          </p>
        </div>
      )}

      {recurrence && (
        <dl className="grid gap-2 border-t border-zinc-200 pt-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Observado</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {recurrence.observedIntervalDays == null
                ? "Sem histórico suficiente"
                : `${recurrence.observedIntervalDays} dias`}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Efetivo</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {recurrence.intervalDays} dias
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Fonte</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {getPurchaseSourceLabel(recurrence.source)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
