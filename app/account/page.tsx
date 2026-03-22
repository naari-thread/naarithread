import Link from "next/link";

export default function AccountPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-16 pb-32 text-primary md:pb-16">
      <section className="w-full max-w-3xl rounded-3xl border border-primary/20 bg-secondary p-8 shadow-sm sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Profile</p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Account</h1>
        <p className="mt-4 text-base leading-relaxed text-primary/85">
          Order history, address book, and profile preferences can be configured from this
          account route.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/products" aria-label="Back to products page" className="cta-thread">
            Shop Now
          </Link>
          <Link
            href="/cart"
            aria-label="Open cart page"
            className="thread-underline text-sm font-semibold uppercase tracking-[0.2em]"
          >
            Cart
          </Link>
        </div>
      </section>
    </main>
  );
}
