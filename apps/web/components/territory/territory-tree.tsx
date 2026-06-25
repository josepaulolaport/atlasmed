"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TerritoryTreeNode } from "@/types/territory";

interface TerritoryTreeProps {
  nodes: TerritoryTreeNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

function TerritoryTreeNodeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: TerritoryTreeNode;
  depth: number;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50",
          isSelected && "bg-blue-50 text-blue-900"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <span
            role="presentation"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="inline-flex shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
        <span className="hidden truncate text-gray-500 sm:inline">
          {node.isCountryLevel ? node.countryCode : node.slug}
        </span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TerritoryTreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
      {isSelected && (
        <div
          className="flex flex-wrap gap-1 px-2 pb-2"
          style={{ paddingLeft: `${depth * 12 + 28}px` }}
        >
          <Badge variant="secondary" className="text-xs">
            {node.territoryType.name}
          </Badge>
          {node.parentAssignmentStatus === "ambiguous" && (
            <Badge variant="destructive" className="text-xs">
              ambiguous parent
            </Badge>
          )}
          {node.isLeaf && (
            <Badge variant="outline" className="text-xs">
              leaf
            </Badge>
          )}
          {node.hasBoundary && (
            <Badge variant="outline" className="text-xs">
              boundary
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {node.clinicCount} clinics
          </Badge>
          <Badge variant="outline" className="text-xs">
            {node.assignedUserCount} users
          </Badge>
        </div>
      )}
    </div>
  );
}

export function TerritoryTree({ nodes, selectedId, onSelect }: TerritoryTreeProps) {
  if (nodes.length === 0) {
    return <p className="text-sm text-gray-500">No territories found.</p>;
  }

  return (
    <div className="divide-y rounded-md border">
      {nodes.map((node) => (
        <TerritoryTreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
