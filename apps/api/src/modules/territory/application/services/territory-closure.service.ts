import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";

interface Dependencies {
  territoryRepository: TerritoryRepository;
  closureRepository: TerritoryClosureRepository;
}

export class TerritoryClosureService {
  constructor(private readonly deps: Dependencies) {}

  async rebuildSubtree(rootTerritoryId: string): Promise<void> {
    const subtreeIds = await this.collectSubtreeIds(rootTerritoryId);
    await this.deps.closureRepository.deleteForDescendants(subtreeIds);

    const rows: Array<{ ancestorId: string; descendantId: string; depth: number }> =
      [];

    for (const descendantId of subtreeIds) {
      rows.push({ ancestorId: descendantId, descendantId, depth: 0 });

      let depth = 1;
      let current = await this.deps.territoryRepository.findById(descendantId);

      while (current?.parentId) {
        rows.push({
          ancestorId: current.parentId,
          descendantId,
          depth,
        });
        depth += 1;
        current = await this.deps.territoryRepository.findById(current.parentId);
      }
    }

    if (rows.length > 0) {
      await this.deps.closureRepository.insertRows(rows);
    }
  }

  async rebuildAll(): Promise<void> {
    const territories = await this.deps.territoryRepository.findAllActive();
    const roots = territories.filter((t) => !t.parentId);

    for (const root of roots) {
      await this.rebuildSubtree(root.id);
    }
  }

  private async collectSubtreeIds(rootId: string): Promise<string[]> {
    const result: string[] = [rootId];
    const children = await this.deps.territoryRepository.findChildren(rootId, false);

    for (const child of children) {
      result.push(...(await this.collectSubtreeIds(child.id)));
    }

    return result;
  }
}
