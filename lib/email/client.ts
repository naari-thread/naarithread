import { Resend } from "resend";

let _client: Resend | null = null;

export function getResendClient(): Resend {
  if (!_client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Missing RESEND_API_KEY environment variable.");
    _client = new Resend(apiKey);
  }
  return _client;
}

export const FROM_ADDRESS = "NaariThread <noreply@naarithread.com>";
export const WHATSAPP_NUMBER = "+91 84878 49852";
export const SUPPORT_EMAIL = "naarithread@gmail.com";
