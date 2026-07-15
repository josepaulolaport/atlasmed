import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const composePath = join(__dirname, "uncloud.compose.yml");
const compose = readFileSync(composePath, "utf8");

function serviceBlock(serviceName) {
  const start = compose.indexOf(`  ${serviceName}:\n`);
  assert.notEqual(start, -1, `Service ${serviceName} not found in ${composePath}`);

  const afterService = compose.slice(start + `  ${serviceName}:\n`.length);
  const nextService = afterService.search(/^  [a-zA-Z0-9_-]+:|^volumes:/m);
  return nextService === -1 ? afterService : afterService.slice(0, nextService);
}

function expectEnv(serviceName, envName) {
  assert.match(serviceBlock(serviceName), new RegExp(`- ${envName}=`));
}

function expectEnvValue(serviceName, envName, envValue) {
  assert.match(serviceBlock(serviceName), new RegExp(`- ${envName}=${envValue}`));
}

describe("production worker startup configuration", () => {
  it("provides legacy API config env required by the API service and jobs worker", () => {
    for (const serviceName of ["atlasmed-api", "atlasmed-api-worker"]) {
      expectEnv(serviceName, "PORT");
      expectEnvValue(serviceName, "JWT_EXPIRES_IN", String.raw`\$\{JWT_EXPIRES_IN:-15m\}`);
    }
  });

  it("provides a resolvable Temporal workflow entrypoint for the CNES worker image", () => {
    const workerSource = readFileSync(
      join(__dirname, "../apps/workers/cnes-ingestion/src/worker.ts"),
      "utf8"
    );
    const workflowIndexPath = join(
      __dirname,
      "../apps/workers/cnes-ingestion/src/workflows/index.ts"
    );
    const workflowIndex = readFileSync(workflowIndexPath, "utf8");

    assert.match(workerSource, /join\([^\n]+,\s*"workflows"\)/);
    assert.equal(existsSync(workflowIndexPath), true);
    assert.match(workflowIndex, /export \{ cnesMonthlyIngestionWorkflow \}/);
  });
});
