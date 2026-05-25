import type { ReactNode } from "react";

export interface SendEmailParams {
  to: string;

  subject: string;

  react: ReactNode;
}

export interface EmailService {
  send(params: SendEmailParams): Promise<void>;
}
