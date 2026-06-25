"use client";

import { useEffect, useState, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { getTerritoryMapProvider } from "@/lib/maps/registry";
import type { TerritoryMapEditorProps } from "./types";

export function TerritoryMapEditor(props: TerritoryMapEditorProps) {
  const [Editor, setEditor] = useState<ComponentType<TerritoryMapEditorProps> | null>(null);

  useEffect(() => {
    void getTerritoryMapProvider().then((provider) => {
      setEditor(() => provider.Editor);
    });
  }, []);

  if (!Editor) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-md border bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return <Editor {...props} />;
}
