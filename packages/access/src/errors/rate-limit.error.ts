import { HttpError } from "./http.error";

export class RateLimitError extends HttpError {
  constructor(message: string = "Too many requests. Please try again later.") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}
