import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const composePath = resolve(import.meta.dir, "uncloud.compose.yml");
const dockerfilePaths = [
  "api.Dockerfile",
  "api-worker.Dockerfile",
  "temporal-worker.Dockerfile",
].map((name) => resolve(import.meta.dir, "docker", name));
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
  it("compresses every public API response", () => {
    // Measured 2026-08-12: the edge compresses what it sends to the client, but
    // the origin was answering Cloudflare in raw JSON — so the long leg, Brazil
    // to a US-hosted cluster, carried uncompressed bytes on every request. Caddy
    // does not compress unless told to, and the omission is invisible: nothing
    // fails, responses are just bigger than they need to be.
    const { compose } = readDeploymentConfig();

    const serviceStart = compose.indexOf("  atlasmed-api:");
    const nextService = compose.indexOf("\n  atlasmed-", serviceStart + 1);
    const service = compose.slice(serviceStart, nextService);

    const siteBlocks = service.match(/^\s{6}\S+ \{$/gm) ?? [];
    expect(siteBlocks.length).toBeGreaterThan(0);
    // Both hostnames, not just the public one: the uncld.dev name is what the
    // cluster and any internal caller uses.
    expect(service.match(/encode zstd gzip/g) ?? []).toHaveLength(
      siteBlocks.length,
    );
  });

  it("builds application images for the ARM64 deployment machine", () => {
    const { compose } = readDeploymentConfig();

    for (const serviceName of [
      "atlasmed-api",
      "atlasmed-api-worker",
      "atlasmed-temporal-worker",
    ]) {
      const serviceStart = compose.indexOf(`  ${serviceName}:`);
      const nextService = compose.indexOf("\n  atlasmed-", serviceStart + 1);
      const service = compose.slice(
        serviceStart,
        nextService === -1 ? undefined : nextService,
      );

      expect(service).toContain("platform: linux/arm64");
      expect(service).toContain("x-machines: oracle-luis");
    }
  });

  it("pins Dockerfile base images to ARM64 for remote Uncloud builds", () => {
    for (const dockerfilePath of dockerfilePaths) {
      const dockerfile = readFileSync(dockerfilePath, "utf8");
      const fromLines = dockerfile
        .split("\n")
        .filter(
          (line) => line.startsWith("FROM ") && !line.includes(" installer AS "),
        );

      expect(fromLines.length).toBeGreaterThan(0);
      for (const fromLine of fromLines) {
        expect(fromLine).toContain("--platform=${DEPLOY_PLATFORM}");
      }
      expect(dockerfile).toContain("ARG DEPLOY_PLATFORM=linux/arm64");
    }
  });

  it("pins the production Meilisearch server to v1.48", () => {
    const { compose } = readDeploymentConfig();
    const meilisearch = compose.slice(
      compose.indexOf("  atlasmed-meilisearch:"),
      compose.indexOf("  atlasmed-minio:"),
    );

    expect(meilisearch).toContain("image: getmeili/meilisearch:v1.48");
  });

  it("keeps the v1.13 volume for rollback and mounts a fresh v1.48 volume", () => {
    const { compose } = readDeploymentConfig();
    const meilisearch = compose.slice(
      compose.indexOf("  atlasmed-meilisearch:"),
      compose.indexOf("  atlasmed-minio:"),
    );
    const volumes = compose.slice(compose.indexOf("volumes:"));

    expect(meilisearch).toContain("atlasmed_meilisearch_data_v148:/meili_data");
    expect(volumes).toContain("  atlasmed_meilisearch_data:");
    expect(volumes).toContain("  atlasmed_meilisearch_data_v148:");
  });

  it("configures the Temporal worker with the internal Meilisearch endpoint and deployed key", () => {
    const { compose } = readDeploymentConfig();
    const temporalWorker = compose.slice(
      compose.indexOf("  atlasmed-temporal-worker:"),
      compose.indexOf("  atlasmed-temporal-db:"),
    );

    expect(temporalWorker).toContain(
      "MEILISEARCH_URL=http://atlasmed-meilisearch:7700",
    );
    expect(temporalWorker).toContain("MEILISEARCH_API_KEY=${MEILISEARCH_API_KEY}");
    expect(temporalWorker).toContain("TEMPORAL_TASK_QUEUE=atlasmed-workflows");

    // Emultec credentials were declared in the config schema but delivered to
    // no container, so the import silently reported success having done
    // nothing. Assert they actually reach the worker.
    for (const key of [
      "EMULTEC_MYSQL_HOST",
      "EMULTEC_MYSQL_PORT",
      "EMULTEC_MYSQL_USER",
      "EMULTEC_MYSQL_PASSWORD",
      "EMULTEC_MYSQL_DATABASE",
    ]) {
      expect(temporalWorker).toContain(`${key}=`);
    }
  });

  it("recreates application services when deploying their mutable production images", () => {
    const { compose, workflow } = readDeploymentConfig();

    expect(compose).toContain("image: atlasmed/api:prod");
    expect(workflow).toContain(
      "uc deploy -f deploy/uncloud.compose.yml atlasmed-api atlasmed-api-worker atlasmed-temporal-worker --recreate --yes",
    );
    // The retired Next.js web service (`atlasmed-web`) is no longer part of the
    // deploy pipeline — the `Remove retired web service` step was removed.
    expect(workflow).toContain(
      "working-directory: deploy\n        run: bun test uncloud.compose.test.ts",
    );
    expect(workflow).toContain(
      "name: Set up QEMU for ARM64 builds\n        uses: docker/setup-qemu-action@v3",
    );
  });
});
