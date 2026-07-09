"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  badge?: string;
  badgeVariant?: "info" | "muted";
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "px-6 border-b border-zinc-200 flex items-center gap-6 overflow-x-auto",
        className
      )}
      style={{ scrollbarWidth: "none" }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "h-12 border-b-2 text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center gap-2",
              active
                ? "border-blue-500 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-900"
            )}
          >
            {item.label}
            {item.badge && (
              <span
                className={cn(
                  "py-0.5 px-1.5 rounded text-xs",
                  item.badgeVariant === "info"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-zinc-100 text-zinc-600"
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
