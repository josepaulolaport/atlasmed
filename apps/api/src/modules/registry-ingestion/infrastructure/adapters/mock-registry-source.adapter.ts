import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  RegistrySnapshot,
  RegistrySourcePort,
} from "../../application/interfaces/registry-source.port";
import { MOCK_REGISTRY_PROVIDER } from "../../application/interfaces/registry-source.port";

interface FixtureFile {
  facilities?: unknown[];
  clinics?: unknown[];
  doctors?: unknown[];
  professionals?: unknown[];
  associations: Array<{ doctorExternalId: string; clinicExternalId: string }>;
}

export class MockRegistrySourceAdapter implements RegistrySourcePort {
  constructor(
    private readonly fixtureName: string,
    private readonly fixturesDir: string
  ) {}

  async fetchSnapshot(): Promise<RegistrySnapshot> {
    const filePath = join(this.fixturesDir, this.fixtureName);
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as FixtureFile;

    return {
      provider: MOCK_REGISTRY_PROVIDER,
      fetchedAt: new Date(),
      facilities: (parsed.facilities ?? parsed.clinics ?? []) as RegistrySnapshot["facilities"],
      doctors: (parsed.professionals ?? parsed.doctors ?? []) as RegistrySnapshot["doctors"],
      associations: parsed.associations,
    };
  }
}
