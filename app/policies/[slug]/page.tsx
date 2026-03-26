import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type PolicyPageProps = {
  params: Promise<{ slug: string }>;
};

type PolicySection = {
  heading: string;
  items: string[];
};

type PolicyData = {
  title: string;
  eyebrow: string;
  intro: string;
  sections: PolicySection[];
};

const policyContent: Record<string, PolicyData> = {
  shipping: {
    title: "Shipping & Delivery",
    eyebrow: "Shipping Policy",
    intro:
      "We are committed to delivering your NaariThread order safely and on time, right to your doorstep across India.",
    sections: [
      {
        heading: "Shipping Charges",
        items: [
          "Standard Shipping Charge: ₹99 across India on all orders.",
          "Free shipping is available on prepaid orders above ₹999.",
          "COD Handling Charge: An additional handling charge is applicable on Cash on Delivery orders.",
          "Express Delivery is available at an extra charge, depending on service availability at your location.",
        ],
      },
      {
        heading: "Delivery Timeline",
        items: [
          "All orders are processed within 24–48 hours after payment confirmation.",
          "Standard delivery usually takes 4–7 business days from the date of dispatch.",
          "Express delivery timelines may vary depending on your location and courier availability.",
          "You will receive a tracking link via SMS and email once your order is dispatched.",
        ],
      },
      {
        heading: "Important Notes",
        items: [
          "Delivery timelines are estimates and may vary during peak festive seasons or public holidays.",
          "NaariThread is not responsible for delays caused by logistics partners or force majeure events.",
          "Ensure your delivery address and contact number are accurate at the time of placing the order.",
          "If you face any delivery issues, please contact us at naarithread@gmail.com or call +91 84878 49852.",
        ],
      },
    ],
  },
  returns: {
    title: "Returns & Refunds",
    eyebrow: "Return & Refund Policy",
    intro:
      "We want you to love every piece from NaariThread. If something is not right, here is how we make it easier for you.",
    sections: [
      {
        heading: "Return Eligibility",
        items: [
          "A return request must be raised within 3 days of the delivery date.",
          "Products must be unused, unworn, and in their original condition with all tags and packaging intact.",
          "Items with signs of use, washing, perfume, stains, or damage will not be accepted for return.",
          "All returns are subject to a quality verification check after pickup.",
        ],
      },
      {
        heading: "How to Raise a Return",
        items: [
          "Contact us at naarithread@gmail.com or call +91 84878 49852 within 3 days of delivery.",
          "Share your order number, reason for return, and clear photos of the item.",
          "Once your return request is approved, a pickup will be arranged at no extra cost for eligible cases.",
          "Return courier charges will depend on the reason for return and will be communicated during approval.",
        ],
      },
      {
        heading: "Refund Policy",
        items: [
          "Approved refunds will be processed to the original payment method or to store wallet credit, depending on the payment mode and order status.",
          "Refund processing may take 5–7 business days after the return is approved and verified.",
          "COD orders are eligible for store wallet credit only.",
          "Original shipping charges are non-refundable unless the return is due to a product defect or error on our part.",
        ],
      },
    ],
  },
  "cancellation-and-refund": {
    title: "Cancellation, COD & Exchange",
    eyebrow: "Cancellation Policy",
    intro:
      "We aim to process your orders quickly. Please review our cancellation, COD, and exchange policies before placing your order.",
    sections: [
      {
        heading: "Order Cancellation",
        items: [
          "Orders can be cancelled only before they are dispatched from our warehouse.",
          "Once an order is shipped, cancellation is not permitted.",
          "To cancel, contact us immediately at naarithread@gmail.com or call +91 84878 49852 with your order details.",
          "Refunds for cancelled prepaid orders will be processed within 5–7 business days to the original payment method.",
        ],
      },
      {
        heading: "Cash on Delivery (COD)",
        items: [
          "Cash on Delivery is available on selected orders and serviceable locations.",
          "An additional COD handling charge may apply and will be shown at checkout.",
          "COD orders may require confirmation via SMS or phone call before dispatch.",
          "Repeated order returns or non-acceptance of COD deliveries may result in restriction of the COD option on your account.",
        ],
      },
      {
        heading: "Exchange Policy",
        items: [
          "Exchanges are available only for size-related issues or in case of a defective or damaged product received.",
          "Exchange requests must be raised within 3 days of delivery.",
          "The replacement item is subject to stock availability at the time of the exchange request.",
          "Products must be unused, unworn, and in original condition with tags and packaging intact for an exchange to be processed.",
        ],
      },
    ],
  },
  "terms-and-conditions": {
    title: "Terms & Conditions",
    eyebrow: "Legal",
    intro:
      "By accessing and using the NaariThread platform, you agree to be bound by the following terms and conditions. Please read them carefully before placing an order.",
    sections: [
      {
        heading: "Use of Platform",
        items: [
          "NaariThread is an online retail platform for women's fashion, operated in India.",
          "You must be at least 18 years of age or have consent from a parent or guardian to use this platform.",
          "You agree not to use the platform for any unlawful purpose or in any way that violates these terms.",
          "NaariThread reserves the right to modify, suspend, or discontinue any part of the service at any time.",
        ],
      },
      {
        heading: "Orders & Pricing",
        items: [
          "All orders are subject to acceptance and availability of the product at the time of placement.",
          "Prices displayed on the platform are in Indian Rupees (INR) and are inclusive of applicable taxes.",
          "NaariThread reserves the right to change product prices without prior notice.",
          "In the event of a pricing error, NaariThread will cancel the order and notify you before any charge is processed.",
        ],
      },
      {
        heading: "Intellectual Property",
        items: [
          "All content on this platform including logos, photographs, product names, and designs are the intellectual property of NaariThread.",
          "Unauthorised reproduction, distribution, or use of any content from this platform is strictly prohibited.",
        ],
      },
      {
        heading: "Governing Law",
        items: [
          "These terms shall be governed by the laws of India.",
          "Any disputes arising from these terms or use of the platform shall be subject to the exclusive jurisdiction of courts in India.",
          "For concerns, contact us at naarithread@gmail.com.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    eyebrow: "Privacy",
    intro:
      "At NaariThread, your privacy is important to us. This policy explains what information we collect, how we use it, and how we protect it.",
    sections: [
      {
        heading: "Information We Collect",
        items: [
          "Personal details you provide during registration or checkout: name, email address, phone number, and delivery address.",
          "Payment information is processed securely through our payment partners and is not stored on our servers.",
          "Order history, browsing behaviour, and preferences to improve your shopping experience.",
          "Device and usage data collected automatically when you visit our platform (e.g., browser type, IP address).",
        ],
      },
      {
        heading: "How We Use Your Information",
        items: [
          "To process and fulfil your orders, including shipping and delivery coordination.",
          "To communicate order updates, shipping notifications, and promotional offers via SMS, WhatsApp, or email.",
          "To improve our platform, product range, and customer service based on usage patterns.",
          "We will never sell your personal data to third parties for marketing purposes.",
        ],
      },
      {
        heading: "Data Sharing",
        items: [
          "We share your delivery address and contact details with our logistics and courier partners solely for order fulfilment.",
          "Your payment details are handled solely by our secure payment gateway partners and are never stored by NaariThread.",
          "We may share information when required by law or regulatory authority.",
        ],
      },
      {
        heading: "Your Rights",
        items: [
          "You can request access to, correction of, or deletion of your personal data at any time.",
          "To update your information or raise a data-related request, contact us at naarithread@gmail.com.",
          "You can opt out of marketing communications at any time by replying STOP to any message or using the unsubscribe link in emails.",
        ],
      },
    ],
  },
  "terms-of-service": {
    title: "Terms of Service",
    eyebrow: "Legal",
    intro:
      "These Terms of Service govern your use of NaariThread. By accessing the platform, you agree to comply with these terms.",
    sections: [
      {
        heading: "Who Can Use the Platform",
        items: [
          "NaariThread is intended for users who are at least 18 years old, or minors using the platform under parental or legal guardian supervision.",
          "The platform is currently intended for users located in India and serviceable regions where we can process orders and deliveries.",
          "You agree to use the platform only for lawful purposes and in accordance with applicable regulations.",
        ],
      },
      {
        heading: "Account Responsibilities",
        items: [
          "You are responsible for keeping your account credentials secure and for activity under your account.",
          "You agree to provide accurate account details, including name, email, and delivery information where needed.",
          "NaariThread may suspend or terminate accounts involved in fraud, abuse, policy violations, or unlawful activity.",
        ],
      },
      {
        heading: "Payment Terms",
        items: [
          "All prices are listed in INR and are subject to change without prior notice.",
          "Orders are confirmed only after successful payment authorization or verified COD confirmation, where applicable.",
          "Payment processing is handled by trusted third-party payment providers. NaariThread does not store full card details.",
        ],
      },
      {
        heading: "Intellectual Property",
        items: [
          "All product images, branding, logos, text, and other platform content are owned by or licensed to NaariThread.",
          "You may not copy, reproduce, distribute, or commercially use any NaariThread content without prior written permission.",
        ],
      },
      {
        heading: "Limitation of Liability",
        items: [
          "NaariThread is not liable for indirect, incidental, special, or consequential damages arising from platform use.",
          "To the maximum extent permitted by law, NaariThread's total liability for any claim is limited to the amount paid for the relevant order.",
          "We are not responsible for delays or failures caused by events beyond reasonable control, including logistics disruptions and force majeure.",
        ],
      },
    ],
  },
  "privacy-policy": {
    title: "Privacy Policy",
    eyebrow: "Privacy",
    intro:
      "This Privacy Policy explains what limited information NaariThread accesses, why it is used, and how users can request deletion.",
    sections: [
      {
        heading: "Data We Access",
        items: [
          "For account and order workflows, we may receive name, email address, and delivery address details provided by the user.",
          "Payment information is processed by payment gateway partners and is not stored directly by NaariThread.",
          "We use Google Sign-In for authentication. When you sign in with Google, we access your name, email address, and profile picture solely for account creation and identification purposes. We do not store your Google password.",
        ],
      },
      {
        heading: "Why We Use Data",
        items: [
          "To create and manage user accounts securely.",
          "To process orders, coordinate delivery, and provide customer support.",
          "To maintain account integrity, prevent misuse, and operate core platform functionality.",
        ],
      },
      {
        heading: "Third-Party Sharing",
        items: [
          "We share only necessary order and contact details with shipping and logistics partners to fulfill deliveries.",
          "Payment transactions are handled by payment gateway providers under their own compliant security standards.",
          "We do not sell personal data to third parties for advertising or unrelated marketing.",
        ],
      },
      {
        heading: "Data Deletion Requests",
        items: [
          "Users can request account and personal data deletion by contacting naarithread@gmail.com with their registered email and request details.",
          "After verification, deletion requests are processed within a reasonable operational timeline, subject to legal or compliance retention requirements.",
        ],
      },
      {
        heading: "Cookie Usage",
        items: [
          "We may use essential cookies or similar technologies to keep users signed in, protect sessions, and support basic website functionality.",
          "Where analytics or non-essential cookies are introduced, this policy will be updated accordingly.",
        ],
      },
      {
        heading: "Important Clarification",
        items: [
          "NaariThread only accesses data necessary for authentication and platform operations. We do not collect or store unnecessary personal information.",
          "For Google OAuth verification: We use Google Sign-In for authentication. When you sign in with Google, we access your name, email address, and profile picture solely for account creation and identification purposes. We do not store your Google password.",
        ],
      },
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(policyContent).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const policy = policyContent[slug];
  if (!policy) return {};
  return {
    title: policy.title,
    description: policy.intro,
  };
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { slug } = await params;
  const policy = policyContent[slug];

  if (!policy) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-paper text-primary">
      {/* Hero band */}
      <section className="bg-primary px-5 pb-14 pt-28 text-secondary md:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-7xl">
          <Link
            href="/"
            aria-label="Return to NaariThread homepage"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70 transition hover:text-secondary"
          >
            <DynamicHugeIcon name="ArrowLeft01Icon" className="h-3.5 w-3.5" iconStrokeWidth={1.9} />
            Back to Home
          </Link>
          <div className="mx-auto mt-8 max-w-4xl text-center">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-secondary/70 sm:text-xs sm:tracking-[0.34em]">
              {policy.eyebrow}
            </p>
            <h1 className="font-display mt-4 text-[2rem] leading-[1.02] sm:text-5xl lg:text-6xl">
              {policy.title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[0.96rem] leading-relaxed text-secondary/80 sm:text-base">
              {policy.intro}
            </p>
            <p className="mt-4 text-xs text-secondary/50">Last updated: January 2025</p>
          </div>
        </div>
      </section>

      {/* Policy content */}
      <section className="px-5 py-16 md:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-4">
            {/* Sticky section nav on large screens */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-primary/15 bg-secondary p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/60">
                  On This Page
                </p>
                <ul className="mt-4 space-y-2">
                  {policy.sections.map((s) => (
                    <li key={s.heading}>
                      <a
                        href={`#${s.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        aria-label={`Jump to ${s.heading}`}
                        className="thread-underline text-sm text-primary/80 transition hover:text-primary"
                      >
                        {s.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            {/* Section content */}
            <div className="space-y-12 lg:col-span-3">
              {policy.sections.map((section) => (
                <div
                  key={section.heading}
                  id={section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                  className="scroll-mt-24 rounded-2xl border border-primary/10 bg-secondary p-6 sm:p-8"
                >
                  <h2 className="text-[1.5rem] leading-tight text-primary sm:text-3xl">
                    {section.heading}
                  </h2>
                  <ul className="mt-5 space-y-3 sm:space-y-3.5">
                    {section.items.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-[0.9rem] leading-relaxed text-primary/85 sm:text-[0.95rem] md:text-base"
                      >
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {/* Contact CTA */}
              <div className="rounded-2xl bg-primary px-6 py-8 text-secondary sm:px-8">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary/70">
                  Have Questions?
                </p>
                <h2 className="font-display mt-3 text-2xl sm:text-3xl">
                  We are here to help
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-secondary/80">
                  Reach out to our team for any queries about orders, returns, or policies.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <a
                    href="mailto:naarithread@gmail.com"
                    aria-label="Email NaariThread support"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-secondary transition hover:text-secondary/80"
                  >
                    <DynamicHugeIcon name="Mail01Icon" className="h-4 w-4" iconStrokeWidth={1.8} />
                    naarithread@gmail.com
                  </a>
                  <a
                    href="tel:+918487849852"
                    aria-label="Call NaariThread support"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-secondary transition hover:text-secondary/80"
                  >
                    <DynamicHugeIcon name="CallIcon" className="h-4 w-4" iconStrokeWidth={1.8} />
                    +91 84878 49852
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

