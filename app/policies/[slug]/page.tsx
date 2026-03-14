import Link from "next/link";
import { notFound } from "next/navigation";

type PolicyPageProps = {
  params: Promise<{ slug: string }>;
};

const policyContent: Record<string, { title: string; description: string }> = {
  shipping: {
    title: "Shipping Policy",
    description:
      "Shipping policy details will be published here, including dispatch timeline, delivery zones, and tracking guidance.",
  },
  returns: {
    title: "Return Policy",
    description:
      "Return eligibility, quality checks, and return window details will be added in this section.",
  },
  "terms-and-conditions": {
    title: "Terms & Conditions",
    description:
      "Platform usage, order terms, and legal terms for purchasing from NaariThread will be available here.",
  },
  privacy: {
    title: "Privacy Policy",
    description:
      "Data collection, processing, and privacy commitments for NaariThread shoppers will be published in this policy.",
  },
  "cancellation-and-refund": {
    title: "Cancellation & Refund Policy",
    description:
      "Order cancellation conditions and refund timelines for online payments including Razorpay will be listed here.",
  },
};

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { slug } = await params;
  const policy = policyContent[slug];

  if (!policy) {
    notFound();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-16 text-primary">
      <section className="w-full max-w-3xl rounded-3xl border border-primary/20 bg-secondary p-8 shadow-sm sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Policy</p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{policy.title}</h1>
        <p className="mt-5 text-base leading-relaxed text-primary/85">{policy.description}</p>
        <p className="mt-4 text-sm text-primary/70">
          TODO: Replace placeholder policy copy with final legal text.
        </p>
        <div className="mt-8">
          <Link href="/" aria-label="Return to NaariThread homepage" className="cta-thread">
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
