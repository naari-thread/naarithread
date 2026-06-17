import { WHATSAPP_NUMBER } from "./client";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const PRIMARY   = "#2A0F0F";
const SECONDARY = "#F5EDE3";
const ACCENT    = "#7C2D2D";
const MUTED     = "rgba(42,15,15,0.55)";
const LOGO_ICON_URL = "https://www.naarithread.com/logo4.png";
const LOGO_TEXT_URL = "https://www.naarithread.com/logoname.png";
const SITE_URL  = "https://www.naarithread.com";

// Sans-serif for everything (numbers stay on baseline — no waving)
const SANS = "Arial, Helvetica, sans-serif";
// Serif only for display headings
const SERIF = "Georgia, 'Times New Roman', serif";

// ─── Base layout ──────────────────────────────────────────────────────────────
function baseLayout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#EAE0D4;font-family:${SANS};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EAE0D4;padding:40px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(42,15,15,0.10);">

      <!-- Logo header -->
      <tr>
        <td style="background:${SECONDARY};padding:24px 36px 18px;text-align:center;border-bottom:1px solid rgba(42,15,15,0.08);">
          <a href="${SITE_URL}" style="display:inline-flex;align-items:center;gap:12px;text-decoration:none;vertical-align:middle;">
            <img src="${LOGO_ICON_URL}" alt="" width="52" height="52"
                 style="display:inline-block;width:52px;height:52px;object-fit:contain;vertical-align:middle;border-radius:8px;" />
            <img src="${LOGO_TEXT_URL}" alt="NaariThread" width="130" height="auto"
                 style="display:inline-block;max-height:52px;object-fit:contain;vertical-align:middle;" />
          </a>
        </td>
      </tr>

      <!-- Dark accent bar -->
      <tr>
        <td style="background:${PRIMARY};padding:10px 36px;text-align:center;">
          <p style="margin:0;font-family:${SANS};font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(245,237,227,0.55);">Wear Your Story</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:${SECONDARY};padding:36px 36px 32px;">
          ${body}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:${PRIMARY};padding:20px 36px;text-align:center;">
          <p style="margin:0;font-family:${SANS};font-size:11px;color:rgba(245,237,227,0.55);">
            Please do not reply to this email — we are unable to receive replies.
          </p>
          <p style="margin:6px 0 0;font-family:${SANS};font-size:11px;color:rgba(245,237,227,0.60);">
            For any help, reach us on WhatsApp:
            <a href="https://wa.me/${WHATSAPP_NUMBER.replace(/\s/g, "").replace("+", "")}" style="color:${SECONDARY};text-decoration:none;font-weight:600;">${WHATSAPP_NUMBER}</a>
          </p>
          <p style="margin:10px 0 0;font-family:${SANS};font-size:10px;color:rgba(245,237,227,0.35);">
            © NaariThread · India · At NaariThread, every thread tells your story.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function h1(text: string) {
  return `<h1 style="margin:0 0 14px;font-family:${SERIF};font-size:26px;font-weight:600;color:${PRIMARY};line-height:1.2;">${text}</h1>`;
}

function p(text: string, muted = false) {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:14px;line-height:1.75;color:${muted ? MUTED : PRIMARY};">${text}</p>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid rgba(42,15,15,0.10);margin:22px 0;"/>`;
}

function kv(label: string, value: string) {
  return `<tr>
    <td style="padding:7px 0;font-family:${SANS};font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:${MUTED};width:44%;vertical-align:top;">${label}</td>
    <td style="padding:7px 0;font-family:${SANS};font-size:14px;font-weight:600;color:${PRIMARY};vertical-align:top;">${value}</td>
  </tr>`;
}

function sectionLabel(text: string) {
  return `<p style="margin:0 0 10px;font-family:${SANS};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${MUTED};">${text}</p>`;
}

type OrderLine = { productName: string; quantity: number; size?: string; color?: string; lineAmount: number };

function itemsTable(lines: OrderLine[]) {
  const rows = lines.map((line) => `
  <tr>
    <td style="padding:11px 0;font-family:${SANS};font-size:13px;color:${PRIMARY};border-bottom:1px solid rgba(42,15,15,0.07);vertical-align:top;">
      <strong>${line.productName}</strong>
      ${line.size  ? `<br/><span style="font-size:11px;color:${MUTED};">Size: ${line.size}</span>` : ""}
      ${line.color ? `<br/><span style="font-size:11px;color:${MUTED};">Colour: ${line.color}</span>` : ""}
    </td>
    <td style="padding:11px 0;font-family:${SANS};font-size:13px;color:${MUTED};text-align:center;border-bottom:1px solid rgba(42,15,15,0.07);vertical-align:top;">×${line.quantity}</td>
    <td style="padding:11px 0;font-family:${SANS};font-size:13px;font-weight:600;color:${PRIMARY};text-align:right;border-bottom:1px solid rgba(42,15,15,0.07);vertical-align:top;">₹${line.lineAmount.toLocaleString("en-IN")}</td>
  </tr>`).join("");

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
    <thead>
      <tr>
        <th style="text-align:left;font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};padding-bottom:8px;font-weight:600;">Item</th>
        <th style="text-align:center;font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};padding-bottom:8px;font-weight:600;">Qty</th>
        <th style="text-align:right;font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};padding-bottom:8px;font-weight:600;">Amount</th>
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

    ${sectionLabel("Order Details")}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${kv("Order No.", orderNumber)}
      ${kv("Amount Paid", `₹${total.toLocaleString("en-IN")}`)}
    </table>

    ${divider()}
    ${sectionLabel("Your Items")}
    ${itemsTable(lines)}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(42,15,15,0.04);border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <tr>
        <td style="font-family:${SANS};font-size:12px;color:${MUTED};padding:4px 0;">Subtotal</td>
        <td style="font-family:${SANS};font-size:12px;text-align:right;color:${PRIMARY};padding:4px 0;">₹${subtotal.toLocaleString("en-IN")}</td>
      </tr>
      ${discount > 0 ? `<tr><td style="font-family:${SANS};font-size:12px;color:#16a34a;padding:4px 0;">Product Discount</td><td style="font-family:${SANS};font-size:12px;text-align:right;color:#16a34a;padding:4px 0;">−₹${discount.toLocaleString("en-IN")}</td></tr>` : ""}
      ${couponDiscount > 0 ? `<tr><td style="font-family:${SANS};font-size:12px;color:#16a34a;padding:4px 0;">Coupon Discount</td><td style="font-family:${SANS};font-size:12px;text-align:right;color:#16a34a;padding:4px 0;">−₹${couponDiscount.toLocaleString("en-IN")}</td></tr>` : ""}
      <tr>
        <td style="font-family:${SANS};font-size:12px;color:${MUTED};padding:4px 0;">Delivery</td>
        <td style="font-family:${SANS};font-size:12px;text-align:right;color:${PRIMARY};padding:4px 0;">${delivery === 0 ? "Free" : `₹${delivery.toLocaleString("en-IN")}`}</td>
      </tr>
      <tr>
        <td style="font-family:${SANS};font-size:14px;font-weight:700;color:${PRIMARY};padding:10px 0 4px;border-top:1px solid rgba(42,15,15,0.10);">Total Paid</td>
        <td style="font-family:${SANS};font-size:14px;font-weight:700;text-align:right;color:${PRIMARY};padding:10px 0 4px;border-top:1px solid rgba(42,15,15,0.10);">₹${total.toLocaleString("en-IN")}</td>
      </tr>
    </table>

    ${divider()}
    ${sectionLabel("Delivering To")}
    ${p(`<strong>${address.fullName}</strong>${address.phone ? ` &nbsp;·&nbsp; ${address.phone}` : ""}<br/><span style="color:${MUTED};">${addressLine}</span>`)}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(124,45,45,0.06);border-left:3px solid ${ACCENT};border-radius:0 8px 8px 0;margin-top:4px;">
      <tr>
        <td style="padding:14px 16px;font-family:${SANS};font-size:13px;color:${PRIMARY};">
          🚚 &nbsp;<strong>Metro Cities:</strong> 1–3 working days &nbsp;·&nbsp; <strong>Non-Metro:</strong> 2–5 working days
        </td>
      </tr>
    </table>
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
  lines?: OrderLine[];
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
  const { customerName, orderNumber, status, total, lines } = data;
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
      ${kv("Order No.", orderNumber)}
      ${kv("Order Total", `₹${total.toLocaleString("en-IN")}`)}
      ${kv("Status", status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))}
    </table>
    ${lines && lines.length > 0 ? `${divider()}${sectionLabel("Your Items")}${itemsTable(lines)}` : ""}
    ${divider()}
    ${p("Reach us on WhatsApp for any questions — our team is happy to help.", true)}
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
      <a href="${SITE_URL}/cart" style="display:inline-block;background:${PRIMARY};color:${SECONDARY};text-decoration:none;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:15px 36px;border-radius:12px;">Complete Your Order →</a>
    </div>
    ${divider()}
    ${p("If you need help choosing a size or have questions about a product, we're here for you!", true)}
  `;

  return baseLayout("Your NaariThread Cart is Waiting | NaariThread", body);
}
