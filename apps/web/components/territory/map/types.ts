import type { ComponentType } from "react";
import type { GeoJsonPolygon } from "@/types/territory";

export interface TerritoryMapEditorProps {
  value: GeoJsonPolygon | null;
  onChange: (geoJson: GeoJsonPolygon | null) => void;
  readOnly?: boolean;
  onValidationError?: (message: string) => void;
}

export interface TerritoryMapProvider {
  Editor: ComponentType<TerritoryMapEditorProps>;
}
