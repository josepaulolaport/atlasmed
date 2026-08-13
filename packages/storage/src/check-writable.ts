/**
 * Proves the configured storage credential can actually write, before a deploy
 * replaces a working container with one that cannot.
 *
 * The API's boot probe already distinguishes a wrong credential from a
 * correctly-scoped one, and it does that carefully — `HeadBucket` is a HEAD, so
 * a 403 carries no body and a bad key looks exactly like a narrow token; it
 * follows up with `ListObjectsV2`, whose 403 does carry a code. What it proves,
 * though, is that the credential can **read**.
 *
 * On 2026-08-12 production ran for some time with an R2 token that could list
 * and not put. Boot was clean. Every upload failed with AccessDenied, and the
 * first anyone knew of it was a rep watching a document say "Falhou". Reading
 * was never the capability worth checking: this service exists to store files.
 *
 * So this writes a small object and deletes it. It runs in CI rather than at
 * boot deliberately — a deploy that fails here leaves the previous container
 * serving, and no request path pays for the check.
 */
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const PROBE_KEY = "_preflight/writable-check";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`storage:check — ${name} is not set.`);
    process.exit(1);
  }
  return value;
}

/**
 * Three failures wear the same "cannot write" coat and are fixed in three
 * different places. Naming the right one is the whole point of failing here
 * rather than at the first upload.
 */
function describeFailure(name: string, bucket: string): string {
  if (name === "NoSuchBucket" || name === "NotFound") {
    return (
      `The bucket "${bucket}" does not exist. Check STORAGE_BUCKET, and that\n` +
      "STORAGE_ENDPOINT points at the account that owns it."
    );
  }
  if (name === "InvalidAccessKeyId" || name === "SignatureDoesNotMatch") {
    return (
      "The credentials are wrong, not merely narrow. Check\n" +
      "STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY — R2 shows both once,\n" +
      "when the token is created, and never again."
    );
  }
  return (
    "The credential is likely read-only. An R2 token needs Object Read &\n" +
    "Write; Object Read alone passes every read check and fails every upload."
  );
}

async function main(): Promise<void> {
  const bucket = required("STORAGE_BUCKET");
  const client = new S3Client({
    region: process.env.STORAGE_REGION ?? "auto",
    endpoint: required("STORAGE_ENDPOINT"),
    credentials: {
      accessKeyId: required("STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: required("STORAGE_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: PROBE_KEY,
        Body: "preflight",
        ContentType: "text/plain",
      }),
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "Unknown";
    // Say which of the two it is. "Cannot write" covers a missing bucket and a
    // narrow credential, and they are fixed in different places — guessing
    // wrong sends someone to the Cloudflare token page over a typo in a name.
    const cause = describeFailure(name, bucket);
    console.error(`storage:check — cannot write to "${bucket}" (${name}).\n${cause}`);
    process.exit(1);
  }

  // Best-effort. A probe object left behind is untidy, not broken, and failing
  // the deploy over a failed cleanup would be worse than the mess.
  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: PROBE_KEY }),
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "Unknown";
    console.warn(
      `storage:check — wrote the probe but could not delete it (${name}). ` +
        `Leaving "${PROBE_KEY}" behind; the credential can write, which is what this checks.`,
    );
  }

  console.log(`Storage write check passed against "${bucket}".`);
}

await main();
