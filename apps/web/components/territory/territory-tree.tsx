"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Territory } from "@/types/territory";

interface TerritoryTreeProps {
  nodes: Territory[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

function TerritoryRow({
  territory,
  selectedId,
  onSelect,
}: {
  territory: Territory;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const isSelected = selectedId === territory.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(territory.id)}
        className={cn(
          "flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50",
          isSelected && "bg-blue-50 text-blue-900"
        )}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{territory.name}</span>
        <span className="hidden truncate text-gray-500 sm:inline">{territory.slug}</span>
      </button>
      {isSelected && (
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          <Badge variant="secondary" className="text-xs">
            {territory.territoryType.name}
          </Badge>
          {territory.hasBoundary && (
            <Badge variant="outline" className="text-xs">
              limite
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {territory.clinicCount} clínicas
          </Badge>
          <Badge variant="outline" className="text-xs">
            {territory.assignedUserCount} usuários
          </Badge>
        </div>
      )}
    </div>
  );
}

export function TerritoryTree({ nodes, selectedId, onSelect }: TerritoryTreeProps) {
  if (nodes.length === 0) {
    return <p className="text-sm text-gray-500">Nenhum território encontrado.</p>;
  }

  return (
    <div className="divide-y rounded-md border">
      {nodes.map((territory) => (
        <TerritoryRow
          key={territory.id}
          territory={territory}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
