import Link from "next/link";

type ProductsPageProps = {
  searchParams: Promise<{ category?: string; subcategory?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { category, subcategory } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-16 text-primary">
      <section className="w-full max-w-3xl rounded-3xl border border-primary/20 bg-secondary p-8 shadow-sm sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">
          Ecommerce Placeholder
        </p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Products Page</h1>
        <p className="mt-4 text-base leading-relaxed text-primary/85">
          Your ecommerce catalog route is ready. Product listing, filters, sorting,
          and Razorpay checkout flow can now be built in this route.
        </p>
        <div className="mt-6 space-y-2 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm">
          <p>
            Active category: <span className="font-semibold">{category ?? "All"}</span>
          </p>
          <p>
            Active subcategory: <span className="font-semibold">{subcategory ?? "All"}</span>
          </p>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/" aria-label="Back to NaariThread landing page" className="cta-thread">
            Back to Landing
          </Link>
          <Link
            href="/products?sort=popular"
            aria-label="Open popular products view"
            className="thread-underline text-sm font-semibold uppercase tracking-[0.2em]"
          >
            Popular View
          </Link>
        </div>
      </section>
    </main>
  );
}
