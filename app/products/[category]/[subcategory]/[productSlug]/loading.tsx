export default function ProductDetailsLoading() {
  return (
    <main className="min-h-screen bg-paper pb-32 pt-0 text-primary sm:pt-16 md:pb-14 md:pt-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb skeleton — desktop only */}
        <div className="mb-5 hidden items-center gap-2.5 md:flex">
          <div className="h-3 w-10 animate-pulse rounded bg-primary/10" />
          <div className="h-3 w-3 animate-pulse rounded bg-primary/10" />
          <div className="h-3 w-16 animate-pulse rounded bg-primary/10" />
          <div className="h-3 w-3 animate-pulse rounded bg-primary/10" />
          <div className="h-3 w-20 animate-pulse rounded bg-primary/10" />
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] md:items-start md:gap-7 lg:gap-10">
          {/* Left: Image Gallery */}
          <div className="relative">
            {/* Desktop gallery */}
            <div className="hidden max-w-[31rem] flex-col gap-3 md:flex">
              <div className="aspect-[4/5] w-full animate-pulse rounded-3xl bg-primary/10" />
              <div className="flex gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="aspect-square w-18 shrink-0 animate-pulse rounded-2xl bg-primary/10" />
                ))}
              </div>
            </div>

            {/* Mobile full-width image */}
            <div className="-mx-4 sm:-mx-6 md:hidden">
              <div className="min-h-[82vw] w-full animate-pulse bg-primary/10" />
            </div>
          </div>

          {/* Right: Product Info */}
          <div className="flex flex-col gap-4 px-0 pt-4 md:pt-0">
            {/* Category tag */}
            <div className="h-3 w-28 animate-pulse rounded bg-primary/10" />

            {/* Title */}
            <div className="flex flex-col gap-2">
              <div className="h-6 w-4/5 animate-pulse rounded-lg bg-primary/10" />
              <div className="h-6 w-3/5 animate-pulse rounded-lg bg-primary/10" />
            </div>

            {/* Rating row */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-3.5 w-3.5 animate-pulse rounded-sm bg-primary/10" />
                ))}
              </div>
              <div className="h-3 w-12 animate-pulse rounded bg-primary/10" />
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <div className="h-7 w-24 animate-pulse rounded-lg bg-primary/10" />
              <div className="h-4 w-16 animate-pulse rounded bg-primary/10" />
              <div className="h-5 w-14 animate-pulse rounded-full bg-primary/10" />
            </div>

            <div className="h-px w-full bg-primary/8" />

            {/* Color selector */}
            <div className="flex flex-col gap-2.5">
              <div className="h-3 w-20 animate-pulse rounded bg-primary/10" />
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-8 w-8 animate-pulse rounded-full bg-primary/10" />
                ))}
              </div>
            </div>

            {/* Size selector */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="h-3 w-16 animate-pulse rounded bg-primary/10" />
                <div className="h-3 w-20 animate-pulse rounded bg-primary/10" />
              </div>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 w-14 animate-pulse rounded-xl bg-primary/10" />
                ))}
              </div>
            </div>

            {/* Add to cart button */}
            <div className="mt-1 h-13 w-full animate-pulse rounded-2xl bg-primary/15" />

            {/* Wishlist / Share row */}
            <div className="flex gap-2">
              <div className="h-11 flex-1 animate-pulse rounded-xl bg-primary/10" />
              <div className="h-11 w-11 animate-pulse rounded-xl bg-primary/10" />
            </div>

            <div className="h-px w-full bg-primary/8" />

            {/* Description lines */}
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`h-3.5 animate-pulse rounded bg-primary/10 ${i === 3 ? "w-2/3" : "w-full"}`} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
