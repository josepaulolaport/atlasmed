import { HttpError } from "./http.error";

export class InvalidCredentialsError extends HttpError {
  constructor(message: string = "Invalid email or password") {
    super(message, 401, "INVALID_CREDENTIALS");
  }
}
