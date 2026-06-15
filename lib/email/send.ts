import { FROM_ADDRESS, getResendClient } from "./client";
import {
  abandonedCartHtml,
  orderConfirmationHtml,
  orderStatusHtml,
  orderStatusSubject,
  type AbandonedCartData,
  type OrderConfirmationData,
  type OrderStatusData,
} from "./templates";

async function safeSend(args: { to: string; subject: string; html: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send");
    return;
  }
  try {
    const resend = getResendClient();
    await resend.emails.send({ from: FROM_ADDRESS, to: args.to, subject: args.subject, html: args.html });
  } catch (err) {
    // Never let email failures surface to the user or break request handling
    console.error("[email] send failed", { to: args.to, subject: args.subject, error: err instanceof Error ? err.message : err });
  }
}

export async function sendOrderConfirmation(to: string, data: OrderConfirmationData) {
  await safeSend({
    to,
    subject: `Order Confirmed — ${data.orderNumber} | NaariThread`,
    html: orderConfirmationHtml(data),
  });
}

export async function sendOrderStatusEmail(to: string, data: OrderStatusData) {
  await safeSend({
    to,
    subject: orderStatusSubject(data.status, data.orderNumber),
    html: orderStatusHtml(data),
  });
}

export async function sendAbandonedCartEmail(to: string, data: AbandonedCartData) {
  await safeSend({
    to,
    subject: "You left something in your NaariThread cart 🛍️",
    html: abandonedCartHtml(data),
  });
}
