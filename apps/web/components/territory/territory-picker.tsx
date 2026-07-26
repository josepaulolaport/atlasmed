"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { territoriesApi } from "@/lib/api/territories";
import type { Territory } from "@/types/territory";
import {
  formatTerritoryLabel,
  territoryMatchesPickerFilters,
  type TerritoryAssignmentPickerConfig,
} from "@/lib/territory/assignment-picker-config";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface TerritoryPickerProps {
  value?: string;
  onChange: (territoryId: string) => void;
  filterAssignableToUsers?: boolean;
  filterAssignableToManagers?: boolean;
  filterAssignsClinics?: boolean;
  filterCanHaveBoundary?: boolean;
  /** When set, only territories of this business vertical are listed. */
  verticalId?: string;
  pickerConfig?: TerritoryAssignmentPickerConfig;
  excludeTerritoryIds?: string[];
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export function TerritoryPicker({
  value,
  onChange,
  filterAssignableToUsers = false,
  filterAssignableToManagers = false,
  filterAssignsClinics = false,
  filterCanHaveBoundary = false,
  verticalId,
  pickerConfig,
  excludeTerritoryIds = [],
  disabled = false,
  placeholder = "Selecionar território",
  id,
}: TerritoryPickerProps) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const excludedIds = useMemo(() => new Set(excludeTerritoryIds), [excludeTerritoryIds]);

  const loadTerritories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await territoriesApi.listTerritories(undefined, verticalId);
      setTerritories(response.data);
    } catch {
      setError("Falha ao carregar territórios");
    } finally {
      setLoading(false);
    }
  }, [verticalId]);

  useEffect(() => {
    loadTerritories();
  }, [loadTerritories]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return territories.filter((t) => {
      if (excludedIds.has(t.id)) return false;
      if (verticalId && t.verticalId !== verticalId) return false;
      if (pickerConfig && !territoryMatchesPickerFilters(t, pickerConfig)) {
        return false;
      }
      if (!t.isActive) return false;
      if (filterAssignableToUsers && !t.territoryType.assignableToUsers) return false;
      if (filterAssignableToManagers && !t.territoryType.assignableToManagers) {
        return false;
      }
      if (filterAssignsClinics && !t.territoryType.assignsClinics) return false;
      if (filterCanHaveBoundary && !t.territoryType.canHaveBoundary) return false;
      if (!query) return true;
      return (
        t.code.toLowerCase().includes(query) ||
        t.slug.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.territoryType.name.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
      );
    });
  }, [
    territories,
    search,
    filterAssignableToUsers,
    filterAssignableToManagers,
    filterAssignsClinics,
    filterCanHaveBoundary,
    pickerConfig,
    excludedIds,
  ]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando territórios...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="Buscar por código, nome, slug ou tipo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="sr-only">
          Território
        </Label>
        <Select
          value={value ?? ""}
          onValueChange={onChange}
          disabled={disabled || filtered.length === 0}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {filtered.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {formatTerritoryLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 && (
        <p className="text-xs text-gray-500">Nenhum território correspondente encontrado.</p>
      )}
    </div>
  );
}

export function useTerritoryLabels() {
  const [map, setMap] = useState<Map<string, Territory>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await territoriesApi.listTerritories();
        if (!cancelled) {
          const next = new Map<string, Territory>();
          for (const t of response.data) {
            next.set(t.id, t);
          }
          setMap(next);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getLabel = useCallback(
    (territoryId: string) => {
      const t = map.get(territoryId);
      return t ? formatTerritoryLabel(t) : territoryId;
    },
    [map]
  );

  return { map, loading, getLabel };
}
