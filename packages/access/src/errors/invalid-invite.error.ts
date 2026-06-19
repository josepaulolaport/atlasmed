import { HttpError } from "./http.error";

export class InvalidInviteError extends HttpError {
  constructor(message: string = "Invalid invite") {
    super(message, 400, "INVALID_INVITE");
  }
}
