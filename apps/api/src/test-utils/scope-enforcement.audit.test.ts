import { describe, expect, it } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SCOPE_ENFORCEMENT_EXEMPT,
  SCOPE_ENFORCEMENT_MANIFEST,
} from "./scope-enforcement.manifest";

const SRC_ROOT = join(import.meta.dir, "..");

const SCOPED_USE_CASE_PATTERN = /scope:\s*ScopeContext/;

function readSource(relativePath: string): string {
  return readFileSync(join(SRC_ROOT, relativePath), "utf-8");
}

function collectScopedUseCaseFiles(): string[] {
  const patterns = [
    new Glob("modules/**/*.use-case.ts"),
    new Glob("modules/**/*.use-cases.ts"),
    new Glob("modules/**/registry-read.service.ts"),
  ];

  const files = new Set<string>();

  for (const glob of patterns) {
    for (const file of glob.scanSync({ cwd: SRC_ROOT })) {
      const content = readSource(file);
      if (SCOPED_USE_CASE_PATTERN.test(content)) {
        files.add(file);
      }
    }
  }

  return [...files].sort();
}

describe("scope enforcement audit (B.2)", () => {
  it("manifest entries point to existing files", () => {
    for (const relativePath of Object.keys(SCOPE_ENFORCEMENT_MANIFEST)) {
      expect(() => readSource(relativePath)).not.toThrow();
    }
  });

  it("every scoped use case is manifested or explicitly exempt", () => {
    const scopedFiles = collectScopedUseCaseFiles();
    const unaccounted = scopedFiles.filter(
      (file) =>
        !SCOPE_ENFORCEMENT_MANIFEST[file] && !SCOPE_ENFORCEMENT_EXEMPT.has(file)
    );

    expect(unaccounted).toEqual([]);
  });

  for (const [relativePath, entry] of Object.entries(SCOPE_ENFORCEMENT_MANIFEST)) {
    it(`enforces scope patterns in ${relativePath}`, () => {
      const content = readSource(relativePath);
      const matched = entry.patterns.some((pattern) => content.includes(pattern));

      expect(matched).toBe(true);
    });
  }
});
