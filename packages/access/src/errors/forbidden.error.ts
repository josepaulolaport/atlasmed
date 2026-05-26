import { HttpError } from "./http.error";

export class ForbiddenError extends HttpError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}
