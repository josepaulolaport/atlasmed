import type { TerritoryNodeType } from "@atlasmed/database";

const SLUG_PATTERN = /^[A-Z0-9]{2,10}$/;

export function slugifyTerritoryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}

export function validateRegionSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function validateStateCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

export class TerritoryCodeGenerator {
  generateRootCode(): string {
    return "BR";
  }

  generateRegionCode(regionSlug: string): string {
    return `BR-${regionSlug.toUpperCase()}`;
  }

  generateStateCode(parentCode: string, stateCode: string): string {
    return `${parentCode}-${stateCode.toUpperCase()}`;
  }

  generateIntermediateCode(parentCode: string, name: string): string {
    const slug = slugifyTerritoryName(name);
    return `${parentCode}-${slug}`;
  }

  generatePatchCode(parentCode: string, sequence: number): string {
    return `${parentCode}-${String(sequence).padStart(2, "0")}`;
  }

  generateCode(params: {
    nodeType: TerritoryNodeType;
    parentCode?: string | null;
    regionSlug?: string | null;
    stateCode?: string | null;
    name: string;
    patchSequence?: number;
  }): string {
    switch (params.nodeType) {
      case "root":
        return this.generateRootCode();
      case "region":
        if (!params.regionSlug) {
          throw new Error("regionSlug is required for region territories");
        }
        return this.generateRegionCode(params.regionSlug);
      case "state":
        if (!params.parentCode || !params.stateCode) {
          throw new Error("parentCode and stateCode are required for state territories");
        }
        return this.generateStateCode(params.parentCode, params.stateCode);
      case "intermediate":
        if (!params.parentCode) {
          throw new Error("parentCode is required for intermediate territories");
        }
        return this.generateIntermediateCode(params.parentCode, params.name);
      case "patch":
        if (!params.parentCode || params.patchSequence === undefined) {
          throw new Error("parentCode and patchSequence are required for patch territories");
        }
        return this.generatePatchCode(params.parentCode, params.patchSequence);
      default:
        throw new Error(`Unknown node type: ${String(params.nodeType)}`);
    }
  }
}
