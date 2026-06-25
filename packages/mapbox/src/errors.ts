export class MapboxError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "MapboxError";
  }
}

export class MapboxNotConfiguredError extends Error {
  constructor() {
    super("Mapbox is not configured");
    this.name = "MapboxNotConfiguredError";
  }
}
