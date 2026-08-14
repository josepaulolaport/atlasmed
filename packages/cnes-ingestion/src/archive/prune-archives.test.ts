import { describe, expect, it } from "bun:test";
import { parseArchiveKey, selectArchivesToPrune } from "./prune-archives";

/**
 * The object store holds cadastro documents as well as these archives, so the
 * question these tests answer is not "does pruning work" but "can pruning ever
 * choose something it should not".
 */
const key = (competence: string) => `cnes/BASE_DE_DADOS_CNES_${competence}.ZIP`;

describe("parseArchiveKey", () => {
  it("recognises an archive key", () => {
    expect(parseArchiveKey(key("202607"))?.reference).toEqual({
      year: 2026,
      month: 7,
    });
  });

  it.each([
    ["a cadastro document", "cadastro/12/34/alvara.pdf"],
    ["a partial upload", "cnes/BASE_DE_DADOS_CNES_202607.ZIP.tmp"],
    ["a lookalike prefix", "cnes-backup/BASE_DE_DADOS_CNES_202607.ZIP"],
    ["a nested key", "cnes/old/BASE_DE_DADOS_CNES_202607.ZIP"],
    ["an impossible month", "cnes/BASE_DE_DADOS_CNES_202613.ZIP"],
    ["something else entirely", "avatars/7/photo.png"],
  ])("refuses %s", (_label, candidate) => {
    expect(parseArchiveKey(candidate)).toBeNull();
  });
});

describe("selectArchivesToPrune", () => {
  it("keeps the newest competences and prunes the rest", () => {
    const decision = selectArchivesToPrune({
      keys: [key("202604"), key("202607"), key("202605"), key("202606")],
      keep: 2,
    });

    expect(decision.keep.map((a) => a.key)).toEqual([key("202607"), key("202606")]);
    expect(decision.prune.map((a) => a.key)).toEqual([key("202605"), key("202604")]);
  });

  it("never deletes anything it does not recognise", () => {
    const decision = selectArchivesToPrune({
      keys: [
        key("202607"),
        key("202601"),
        "cadastro/12/34/alvara.pdf",
        "cnes/README.txt",
      ],
      keep: 1,
    });

    // The unrecognised keys are reported, not pruned — this bucket is shared.
    expect(decision.prune.map((a) => a.key)).toEqual([key("202601")]);
    expect(decision.ignored.sort()).toEqual([
      "cadastro/12/34/alvara.pdf",
      "cnes/README.txt",
    ]);
  });

  it("spares the competence the current run is reading", () => {
    // The run that triggers a prune is still holding its own archive open; a
    // small `keep` must not delete the thing being read.
    const decision = selectArchivesToPrune({
      keys: [key("202607"), key("202606"), key("202605")],
      keep: 1,
      protectedReference: { year: 2026, month: 5 },
    });

    expect(decision.keep.map((a) => a.key)).toContain(key("202605"));
    expect(decision.prune.map((a) => a.key)).toEqual([key("202606")]);
  });

  it("never prunes everything, even if asked to keep none", () => {
    const decision = selectArchivesToPrune({
      keys: [key("202607"), key("202606")],
      keep: 0,
    });
    // A misconfigured zero would otherwise empty the prefix and force a
    // re-fetch of every competence.
    expect(decision.keep).toHaveLength(1);
    expect(decision.keep[0]!.key).toBe(key("202607"));
  });

  it("does nothing when there is less than the keep count", () => {
    const decision = selectArchivesToPrune({ keys: [key("202607")], keep: 2 });
    expect(decision.prune).toHaveLength(0);
  });
});
