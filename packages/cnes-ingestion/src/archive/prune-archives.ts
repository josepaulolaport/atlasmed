import { CNES_REFERENCE_PATTERN, parseReference, type CnesReference } from "../cnes-files";

/**
 * Deciding which stored archives to delete.
 *
 * A pure function, deliberately: the dangerous part of pruning is choosing, not
 * deleting, and choosing can be proved without a bucket. The object store this
 * runs against also holds cadastro documents, so "delete the old ones" has to
 * mean *exactly* the CNES archives and nothing that merely looks adjacent.
 */

/** `cnes/BASE_DE_DADOS_CNES_202607.ZIP` and nothing else. */
const ARCHIVE_KEY_PATTERN = /^cnes\/(BASE_DE_DADOS_CNES_(\d{6})\.ZIP)$/i;

export interface StoredArchive {
  key: string;
  reference: CnesReference;
}

/**
 * Recognises a stored archive, or returns null.
 *
 * Anchored at both ends and matched against the full key. A prefix match would
 * accept `cnes/BASE_DE_DADOS_CNES_202607.ZIP.tmp`, and a loose one would accept
 * anything under a folder someone later names `cnes-something`.
 */
export function parseArchiveKey(key: string): StoredArchive | null {
  const match = ARCHIVE_KEY_PATTERN.exec(key);
  if (!match) return null;
  const reference = parseReference(match[2]!);
  if (!reference) return null;
  return { key, reference };
}

export interface PruneDecision {
  /** Kept: the most recent competences, newest first. */
  keep: StoredArchive[];
  /** Safe to delete. */
  prune: StoredArchive[];
  /** Keys under the prefix that are not CNES archives. Never deleted. */
  ignored: string[];
}

/**
 * Chooses which archives to keep.
 *
 * @param keep how many competences to retain, newest first
 * @param protectedReference a competence that must survive regardless — the one
 *   the current run just loaded. Without this, a prune running beside an
 *   unusual `keep` could delete the archive the run is still reading.
 */
export function selectArchivesToPrune(input: {
  keys: string[];
  keep: number;
  protectedReference?: CnesReference;
}): PruneDecision {
  const ignored: string[] = [];
  const archives: StoredArchive[] = [];

  for (const key of input.keys) {
    const archive = parseArchiveKey(key);
    if (archive) archives.push(archive);
    else ignored.push(key);
  }

  archives.sort(
    (a, b) =>
      b.reference.year * 12 +
      b.reference.month -
      (a.reference.year * 12 + a.reference.month)
  );

  const keepCount = Math.max(1, input.keep);
  const keep: StoredArchive[] = [];
  const prune: StoredArchive[] = [];

  for (const [index, archive] of archives.entries()) {
    const isProtected =
      input.protectedReference !== undefined &&
      archive.reference.year === input.protectedReference.year &&
      archive.reference.month === input.protectedReference.month;
    if (index < keepCount || isProtected) keep.push(archive);
    else prune.push(archive);
  }

  return { keep, prune, ignored };
}

export { CNES_REFERENCE_PATTERN };
