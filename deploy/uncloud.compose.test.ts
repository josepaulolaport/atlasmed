import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const composePath = resolve(import.meta.dir, "uncloud.compose.yml");
const workflowPath = resolve(
  import.meta.dir,
  "../.github/workflows/deploy-services-to-cluster.yml",
);

function readDeploymentConfig() {
  return {
    compose: readFileSync(composePath, "utf8"),
    workflow: readFileSync(workflowPath, "utf8"),
  };
}

describe("production deployment", () => {
  it("configures the CNES worker with the internal Meilisearch endpoint and deployed key", () => {
    const { compose } = readDeploymentConfig();
    const cnesWorker = compose.slice(compose.indexOf("  atlasmed-cnes-worker:"), compose.indexOf("  atlasmed-temporal-db:"));

    expect(cnesWorker).toContain("MEILISEARCH_URL=http://atlasmed-meilisearch:7700");
    expect(cnesWorker).toContain("MEILISEARCH_API_KEY=${MEILISEARCH_API_KEY}");
  });

  it("recreates application services when deploying their mutable production images", () => {
    const { compose, workflow } = readDeploymentConfig();

    expect(compose).toContain("image: atlasmed/api:prod");
    expect(compose).toContain("image: atlasmed/web:prod");
    expect(workflow).toContain(
      "uc deploy -f deploy/uncloud.compose.yml atlasmed-api atlasmed-api-worker atlasmed-cnes-worker atlasmed-web --recreate --yes",
    );
    expect(workflow).toContain("working-directory: deploy\n        run: bun test uncloud.compose.test.ts");
  });
});
