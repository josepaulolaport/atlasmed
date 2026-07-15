export function hasDuplicatePathSlashes(request: Request): boolean {
  return new URL(request.url).pathname.includes("//");
}
