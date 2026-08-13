import {
  archiveFileName,
  CNES_REFERENCE_PATTERN,
  parseReference,
  type CnesReference,
} from "../cnes-files";

/**
 * Fetching the monthly archive from DATASUS over HTTPS.
 *
 * Sequential only — the endpoint sends `Transfer-Encoding: chunked` and honours
 * no byte ranges. That is the whole reason the archive is stored in a bucket
 * (ADR 0010): this transport can fetch the file reliably and cannot seek in it,
 * and S3 can seek and cannot fetch it.
 */

export interface CnesHttpsSource {
  /** e.g. `https://cnes.datasus.gov.br`. */
  baseUrl: string;
  /** Path of the JSON listing, relative to `baseUrl`. */
  listingPath: string;
  /** Path of the download servlet, relative to `baseUrl`. */
  downloadPath: string;
}

export const DEFAULT_HTTPS_SOURCE: CnesHttpsSource = {
  baseUrl: "https://cnes.datasus.gov.br",
  listingPath: "/services/arquivos-download/base-dados/",
  downloadPath: "/EstatisticasServlet",
};

/**
 * The listing endpoint refuses requests without a browser `User-Agent`, answering
 * "Your connection was refused" rather than a status code. Sent deliberately, and
 * called out because it is the fragile part of discovery: if this ever starts
 * failing, suspect the header before suspecting an outage.
 */
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** First bytes of any ZIP. The only trustworthy proof a download is an archive. */
export const ZIP_LOCAL_HEADER_MAGIC = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);

function headers(source: CnesHttpsSource): Record<string, string> {
  return {
    "user-agent": BROWSER_USER_AGENT,
    referer: `${source.baseUrl}/pages/downloads/arquivosBaseDados.jsp`,
  };
}

interface ListingEntry {
  nomeArquivo?: unknown;
}

/**
 * Competences DATASUS is currently publishing, newest first.
 *
 * **Not "the current month".** The export lags: on 2026-08-13 the newest
 * published competence was 202607. A caller that assumed the current month would
 * ask for a file that does not exist.
 *
 * **Never inferred from an HTTP status.** The download servlet answers `200` with
 * an empty body for a competence that does not exist, so probing URLs would
 * "discover" every month forever.
 */
export async function listCnesReferences(
  source: CnesHttpsSource = DEFAULT_HTTPS_SOURCE
): Promise<CnesReference[]> {
  const response = await fetch(`${source.baseUrl}${source.listingPath}`, {
    headers: headers(source),
  });
  if (!response.ok) {
    throw new Error(
      `CNES listing returned ${response.status} — if this is 403, suspect the User-Agent requirement before an outage`
    );
  }

  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    // The refusal is a plain-text body, not a status code.
    throw new Error(
      `CNES listing was not JSON (first 80 chars: ${body.slice(0, 80).trim()})`
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error("CNES listing was not an array");
  }

  const references: CnesReference[] = [];
  for (const entry of parsed as ListingEntry[]) {
    const name = typeof entry?.nomeArquivo === "string" ? entry.nomeArquivo : "";
    const match = CNES_REFERENCE_PATTERN.exec(name);
    if (!match) continue;
    const reference = parseReference(match[1]!);
    if (reference) references.push(reference);
  }

  return references.sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month));
}

export function archiveDownloadUrl(
  reference: CnesReference,
  source: CnesHttpsSource = DEFAULT_HTTPS_SOURCE
): string {
  const file = archiveFileName(reference);
  return `${source.baseUrl}${source.downloadPath}?path=${encodeURIComponent(file)}`;
}

export interface ArchiveDownload {
  /** The archive's bytes. Sequential; there is no seeking here. */
  body: ReadableStream<Uint8Array>;
  /** Present only if the server sent one — it usually does not. */
  declaredLength: number | null;
}

/**
 * Opens the archive for reading.
 *
 * Verifies the ZIP magic before returning, so a competence that does not exist —
 * which answers `200` with an empty body — fails here rather than after a
 * multipart upload of nothing.
 */
export async function openCnesArchiveDownload(input: {
  reference: CnesReference;
  source?: CnesHttpsSource;
  signal?: AbortSignal;
}): Promise<ArchiveDownload> {
  const source = input.source ?? DEFAULT_HTTPS_SOURCE;
  const url = archiveDownloadUrl(input.reference, source);
  const response = await fetch(url, {
    headers: headers(source),
    signal: input.signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`CNES download returned ${response.status} for ${url}`);
  }

  const reader = response.body.getReader();
  const first = await reader.read();
  const head = first.value ?? new Uint8Array(0);
  if (
    head.length < ZIP_LOCAL_HEADER_MAGIC.length ||
    !ZIP_LOCAL_HEADER_MAGIC.every((byte, index) => head[index] === byte)
  ) {
    await reader.cancel().catch(() => undefined);
    throw new Error(
      `${archiveFileName(input.reference)} is not a ZIP — ` +
        `the servlet answers 200 with an empty body for a competence that does not exist ` +
        `(got ${head.length} bytes)`
    );
  }

  // The first chunk has already been pulled off the reader, so it is replayed
  // ahead of the rest rather than lost.
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(head);
    },
    async pull(controller) {
      const next = await reader.read();
      if (next.done) controller.close();
      else controller.enqueue(next.value);
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });

  const declared = response.headers.get("content-length");
  return {
    body,
    declaredLength: declared ? Number(declared) : null,
  };
}
