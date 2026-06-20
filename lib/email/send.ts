import { FROM_ADDRESS, getResendClient } from "./client";
import {
  abandonedCartHtml,
  orderConfirmationHtml,
  orderStatusHtml,
  orderStatusSubject,
  refundWalletPayoutAlertHtml,
  type AbandonedCartData,
  type OrderConfirmationData,
  type OrderStatusData,
  type RefundWalletPayoutAlertData,
} from "./templates";

async function safeSend(args: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
}): Promise<string | null> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set - skipping email send");
    return null;
  }

  try {
    const resend = getResendClient();
    const result = await resend.emails.send(
      { from: FROM_ADDRESS, to: args.to, subject: args.subject, html: args.html },
      args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : undefined,
    );
    if (result.error) {
      console.error("[email] send rejected", {
        to: args.to,
        subject: args.subject,
        error: result.error.message,
      });
      return null;
    }
    return result.data?.id ?? null;
  } catch (error) {
    console.error("[email] send failed", {
      to: args.to,
      subject: args.subject,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

export async function sendOrderConfirmation(
  to: string,
  data: OrderConfirmationData,
  idempotencyKey: string,
): Promise<string | null> {
  return safeSend({
    to,
    subject: `Order Confirmed - ${data.orderNumber} | NaariThread`,
    html: orderConfirmationHtml(data),
    idempotencyKey,
  });
}

export async function sendOrderStatusEmail(to: string, data: OrderStatusData): Promise<void> {
  await safeSend({
    to,
    subject: orderStatusSubject(data.status, data.orderNumber),
    html: orderStatusHtml(data),
  });
}

export async function sendAbandonedCartEmail(to: string, data: AbandonedCartData): Promise<void> {
  await safeSend({
    to,
    subject: "You left something in your NaariThread cart",
    html: abandonedCartHtml(data),
  });
}

export async function sendRefundWalletPayoutAlert(data: RefundWalletPayoutAlertData): Promise<void> {
  const adminInbox = "naarithread@gmail.com";
  await safeSend({
    to: adminInbox,
    subject: `Refund Wallet transfer request - ${data.requestNumber} | NaariThread`,
    html: refundWalletPayoutAlertHtml(data),
    idempotencyKey: `refund-wallet-alert/${data.requestNumber}`,
  });
}
