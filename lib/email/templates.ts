import { SUPPORT_EMAIL, WHATSAPP_NUMBER } from "./client";

// ─── Brand colours (match globals.css) ────────────────────────────────────────
const PRIMARY = "#2A0F0F";
const SECONDARY = "#F5EDE3";
const ACCENT = "#7C2D2D";

function baseLayout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F0E8DC;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0E8DC;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:${PRIMARY};border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
          <p style="margin:0;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(245,237,227,0.65);">NAARITHREAD</p>
          <p style="margin:6px 0 0;font-size:13px;letter-spacing:0.15em;color:${SECONDARY};font-style:italic;">Wear Your Story</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:${SECONDARY};padding:36px 36px 28px;border-left:1px solid rgba(42,15,15,0.1);border-right:1px solid rgba(42,15,15,0.1);">
          ${body}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:${PRIMARY};border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(245,237,227,0.6);">Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${SECONDARY};">${SUPPORT_EMAIL}</a> &nbsp;|&nbsp; WhatsApp: ${WHATSAPP_NUMBER}</p>
          <p style="margin:8px 0 0;font-size:10px;color:rgba(245,237,227,0.4);">© NaariThread · India · At NaariThread, every thread tells your story.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 12px;font-size:26px;color:${PRIMARY};font-weight:600;line-height:1.15;">${text}</h1>`;
}

function p(text: string, muted = false) {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:${muted ? "rgba(42,15,15,0.65)" : PRIMARY};">${text}</p>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid rgba(42,15,15,0.12);margin:20px 0;"/>`;
}

function badge(label: string, value: string) {
  return `<tr>
    <td style="padding:6px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(42,15,15,0.55);width:44%;">${label}</td>
    <td style="padding:6px 0;font-size:14px;font-weight:600;color:${PRIMARY};">${value}</td>
  </tr>`;
}

type OrderLine = { productName: string; quantity: number; size?: string; color?: string; lineAmount: number };

function itemsTable(lines: OrderLine[]) {
  const rows = lines
    .map(
      (line) => `<tr>
    <td style="padding:10px 0;font-size:13px;color:${PRIMARY};border-bottom:1px solid rgba(42,15,15,0.08);">
      <strong>${line.productName}</strong>
      ${line.size ? `<span style="font-size:11px;color:rgba(42,15,15,0.55);margin-left:8px;">Size: ${line.size}</span>` : ""}
      ${line.color ? `<span style="font-size:11px;color:rgba(42,15,15,0.55);margin-left:8px;">Colour: ${line.color}</span>` : ""}
    </td>
    <td style="padding:10px 0;font-size:13px;color:rgba(42,15,15,0.55);text-align:center;border-bottom:1px solid rgba(42,15,15,0.08);">×${line.quantity}</td>
    <td style="padding:10px 0;font-size:13px;font-weight:600;color:${PRIMARY};text-align:right;border-bottom:1px solid rgba(42,15,15,0.08);">₹${line.lineAmount.toLocaleString("en-IN")}</td>
  </tr>`
    )
    .join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
  <thead>
    <tr>
      <th style="text-align:left;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(42,15,15,0.5);padding-bottom:8px;">Item</th>
      <th style="text-align:center;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(42,15,15,0.5);padding-bottom:8px;">Qty</th>
      <th style="text-align:right;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(42,15,15,0.5);padding-bottom:8px;">Amount</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

// ─── Order Confirmation ───────────────────────────────────────────────────────
export type OrderConfirmationData = {
  customerName: string;
  orderNumber: string;
  lines: OrderLine[];
  subtotal: number;
  delivery: number;
  discount: number;
  couponDiscount: number;
  total: number;
  address: { fullName: string; houseNo?: string; locality?: string; landmark?: string; city: string; state: string; postalCode: string; country: string; phone?: string };
};

export function orderConfirmationHtml(data: OrderConfirmationData): string {
  const { customerName, orderNumber, lines, subtotal, delivery, discount, couponDiscount, total, address } = data;
  const name = customerName || address.fullName || "Valued Customer";
  const addressLine = [address.houseNo, address.locality, address.landmark, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(", ");

  const body = `
    ${h1("Order Confirmed! 🌸")}
    ${p(`Namaste ${name},<br/>Thank you for your order — we're so happy to be dressing you up! Your order has been confirmed and will be dispatched within 24–48 hours.`)}
    ${divider()}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${badge("Order No.", orderNumber)}
      ${badge("Amount Paid", `₹${total.toLocaleString("en-IN")}`)}
    </table>

    ${divider()}
    <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(42,15,15,0.55);">Your Items</p>
    ${itemsTable(lines)}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(42,15,15,0.04);border-radius:8px;padding:12px 16px;margin-bottom:20px;">
      <tr><td style="font-size:12px;color:rgba(42,15,15,0.65);padding:3px 0;">Subtotal</td><td style="font-size:12px;text-align:right;color:${PRIMARY};">₹${subtotal.toLocaleString("en-IN")}</td></tr>
      ${discount > 0 ? `<tr><td style="font-size:12px;color:#16a34a;padding:3px 0;">Product Discount</td><td style="font-size:12px;text-align:right;color:#16a34a;">−₹${discount.toLocaleString("en-IN")}</td></tr>` : ""}
      ${couponDiscount > 0 ? `<tr><td style="font-size:12px;color:#16a34a;padding:3px 0;">Coupon Discount</td><td style="font-size:12px;text-align:right;color:#16a34a;">−₹${couponDiscount.toLocaleString("en-IN")}</td></tr>` : ""}
      <tr><td style="font-size:12px;color:rgba(42,15,15,0.65);padding:3px 0;">Delivery</td><td style="font-size:12px;text-align:right;color:${PRIMARY};">${delivery === 0 ? "Free" : `₹${delivery.toLocaleString("en-IN")}`}</td></tr>
      <tr><td style="font-size:14px;font-weight:700;color:${PRIMARY};padding:8px 0 3px;border-top:1px solid rgba(42,15,15,0.1);">Total Paid</td><td style="font-size:14px;font-weight:700;text-align:right;color:${PRIMARY};padding:8px 0 3px;border-top:1px solid rgba(42,15,15,0.1);">₹${total.toLocaleString("en-IN")}</td></tr>
    </table>

    ${divider()}
    <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(42,15,15,0.55);">Delivering To</p>
    ${p(`<strong>${address.fullName}</strong>${address.phone ? ` · ${address.phone}` : ""}<br/>${addressLine}`)}

    <div style="background:rgba(124,45,45,0.06);border-left:3px solid ${ACCENT};border-radius:4px;padding:14px 16px;margin-top:8px;">
      <p style="margin:0;font-size:13px;color:${PRIMARY};">📦 <strong>Metro Cities:</strong> 1–3 working days &nbsp;|&nbsp; <strong>Non-Metro:</strong> 2–5 working days</p>
    </div>
  `;

  return baseLayout(`Order Confirmed — ${orderNumber} | NaariThread`, body);
}

// ─── Order Status Update ──────────────────────────────────────────────────────
export type OrderStatusData = {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  status: string;
  total: number;
};

const STATUS_COPY: Record<string, { emoji: string; heading: string; message: string }> = {
  confirmed: {
    emoji: "✅",
    heading: "Order Confirmed",
    message: "Great news! Your order has been confirmed and will be dispatched within 24–48 hours.",
  },
  shipped: {
    emoji: "🚚",
    heading: "Your Order is On Its Way!",
    message: "Your order has been shipped and is heading your way. Metro cities: 1–3 working days · Non-metro: 2–5 working days.",
  },
  out_for_delivery: {
    emoji: "🛵",
    heading: "Out for Delivery Today",
    message: "Your package is out for delivery and will arrive today. Please keep your phone handy for the delivery partner.",
  },
  delivered: {
    emoji: "🎉",
    heading: "Delivered Successfully!",
    message: "Your NaariThread order has been delivered. We hope you love your new look! If there are any issues, contact us within 3 days.",
  },
  completed: {
    emoji: "🌸",
    heading: "Order Completed",
    message: "Thank you for shopping with NaariThread. Your order journey is complete. We'd love to hear how you felt in our pieces!",
  },
  cancelled: {
    emoji: "❌",
    heading: "Order Cancelled",
    message: "Your order has been cancelled. If you paid online, your refund will be processed within 5–7 business days. For queries, reach us on WhatsApp.",
  },
};

export function orderStatusHtml(data: OrderStatusData): string {
  const { customerName, orderNumber, status, total } = data;
  const name = customerName || "Valued Customer";
  const copy = STATUS_COPY[status] ?? {
    emoji: "📦",
    heading: "Order Update",
    message: `Your order status has been updated to: ${status.replace(/_/g, " ")}.`,
  };

  const body = `
    ${h1(`${copy.emoji} ${copy.heading}`)}
    ${p(`Hi ${name},<br/>${copy.message}`)}
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${badge("Order No.", orderNumber)}
      ${badge("Order Total", `₹${total.toLocaleString("en-IN")}`)}
      ${badge("Status", status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))}
    </table>
    ${divider()}
    ${p("For any questions, you can reply to this email or reach us on WhatsApp for faster support.", true)}
  `;

  return baseLayout(`Order Update: ${copy.heading} — ${orderNumber} | NaariThread`, body);
}

export function orderStatusSubject(status: string, orderNumber: string): string {
  const copy = STATUS_COPY[status];
  if (copy) return `${copy.emoji} ${copy.heading} — ${orderNumber} | NaariThread`;
  return `Order Update — ${orderNumber} | NaariThread`;
}

// ─── Abandoned Cart ───────────────────────────────────────────────────────────
export type AbandonedCartData = {
  customerName: string;
  itemCount: number;
};

export function abandonedCartHtml(data: AbandonedCartData): string {
  const { customerName, itemCount } = data;
  const name = customerName || "there";

  const body = `
    ${h1("You left something behind! 🛍️")}
    ${p(`Hi ${name},<br/>You added <strong>${itemCount} item${itemCount !== 1 ? "s" : ""}</strong> to your NaariThread cart but didn't complete your order. Your cart is waiting for you!`)}
    ${divider()}
    <div style="text-align:center;padding:16px 0;">
      <a href="https://www.naarithread.com/cart" style="display:inline-block;background:${PRIMARY};color:${SECONDARY};text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;padding:14px 32px;border-radius:12px;">Complete Your Order →</a>
    </div>
    ${divider()}
    ${p("If you need help choosing a size or have questions about a product, we're here for you!", true)}
  `;

  return baseLayout("Your NaariThread Cart is Waiting | NaariThread", body);
}
