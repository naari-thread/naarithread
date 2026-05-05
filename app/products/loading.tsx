export default function ProductsLoading() {
  return (
    <main className="min-h-screen bg-paper px-4 pb-32 py-5 text-primary md:px-8 md:pb-20 md:pt-26">
      <section className="mx-auto w-full max-w-7xl animate-pulse">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="space-y-2">
            <div className="h-2.5 w-24 rounded-full bg-primary/15" />
            <div className="h-8 w-64 rounded-xl bg-primary/12" />
          </div>
          <div className="hidden h-3 w-20 rounded-full bg-primary/12 sm:block" />
        </div>

        <div className="flex flex-wrap gap-2.5 border-b border-primary/12 pb-4 sm:gap-3">
          <div className="h-11 min-w-[170px] rounded-xl bg-secondary" />
          <div className="h-11 min-w-[170px] rounded-xl bg-secondary" />
          <div className="h-11 min-w-[220px] flex-1 rounded-xl bg-secondary" />
          <div className="h-11 w-11 rounded-xl bg-secondary" />
        </div>
      </section>

      <section className="mx-auto mt-5 grid w-full max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <article key={`products-loading-card-${index}`} className="overflow-hidden rounded-2xl border border-primary/12 bg-secondary/70">
            <div className="aspect-[3/4] w-full bg-primary/10" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded bg-primary/12" />
              <div className="h-3 w-1/2 rounded bg-primary/10" />
              <div className="h-9 w-full rounded-xl bg-primary/10" />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
