export interface SendMessageParams {
  to: string;

  message: string;
}

export interface MessagingService {
  send(params: SendMessageParams): Promise<void>;
}
