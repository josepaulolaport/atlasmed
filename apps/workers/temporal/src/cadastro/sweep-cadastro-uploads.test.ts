import { describe, expect, it } from "bun:test";
import {
  SWEEP_GRACE_MS,
  classifyStaleUpload,
} from "./sweep-cadastro-uploads";

/**
 * The sweep's only branching. Everything around it is a query or a write, so
 * these three cases are the behaviour worth pinning.
 */
describe("classifying a stale upload against the store", () => {
  const asset = { sizeBytes: 1024 };

  it("recovers an upload the store has, at the size promised", () => {
    // Spec 0011 §1's orphan: the client PUT the bytes and died before calling
    // /uploads/complete. The file is genuinely there — deleting it would make
    // the rep upload it again for no reason.
    expect(
      classifyStaleUpload(asset, { exists: true, contentLength: 1024 })
    ).toBe("recover");
  });

  it("fails an upload whose stored size contradicts the declared size", () => {
    expect(
      classifyStaleUpload(asset, { exists: true, contentLength: 12 })
    ).toBe("fail");
  });

  it("deletes an upload the store never received", () => {
    // Deliberately NOT "fail", which is what /uploads/complete returns for the
    // same answer. Hours later there is no rep waiting for an error message —
    // the row is only a ghost blocking submit.
    expect(classifyStaleUpload(asset, { exists: false })).toBe("delete");
  });

  it("treats a store that reports no length as agreement, not mismatch", () => {
    // Absence of evidence is not evidence of a mismatch. Guessing "fail" here
    // would mark good files broken whenever a provider omits Content-Length.
    expect(classifyStaleUpload(asset, { exists: true })).toBe("recover");
  });

  it("leaves room for the longest legitimate upload before acting", () => {
    // The grace must not undercut the multipart session TTL, or the sweep would
    // delete files reps are still uploading. Six hours, matching the API.
    expect(SWEEP_GRACE_MS).toBe(6 * 60 * 60 * 1000);
  });
});
