import Link from "next/link";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type ProductsPageProps = {
  searchParams: Promise<{ category?: string }>;
};

type ProductCategory = {
  label: string;
  value: string;
};

const mobileCategories: ProductCategory[] = [
  { label: "All", value: "" },
  { label: "Ethnic", value: "ethnic-wear" },
  { label: "Western", value: "western-wear" },
  { label: "Bottom", value: "bottom-wear" },
  { label: "Fusion", value: "fusion-wear" },
];

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { category } = await searchParams;
  const activeCategory = category ?? "";

  return (
    <main className="min-h-screen bg-paper px-4 pb-32 pt-4 text-primary md:px-8 md:pb-20 md:pt-28">
      <section className="mx-auto w-full max-w-3xl">
        <div className="rounded-[1.45rem] border border-primary/12 bg-secondary/90 p-3 shadow-[0_16px_40px_rgba(120,0,0,0.08)] sm:p-5">
          <div className="flex items-center gap-3">
            <label
              htmlFor="products-search"
              className="group flex h-12 flex-1 items-center gap-2.5 rounded-2xl border border-primary/10 bg-paper px-3.5"
            >
              <DynamicHugeIcon
                name="Search01Icon"
                className="h-4.5 w-4.5 shrink-0 text-primary/70"
                iconStrokeWidth={1.9}
                aria-hidden={true}
              />
              <input
                id="products-search"
                type="search"
                aria-label="Search for any product"
                placeholder="Search for any product"
                className="w-full bg-transparent text-[0.98rem] text-primary placeholder:text-primary/65 outline-none"
              />
            </label>

            <button
              type="button"
              aria-label="Open product filters"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-paper text-primary transition hover:bg-secondary"
            >
              <DynamicHugeIcon
                name="FilterHorizontalIcon"
                className="h-4.5 w-4.5"
                iconStrokeWidth={1.9}
                aria-hidden={true}
              />
            </button>
          </div>

          <div className="mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {mobileCategories.map((item) => {
              const isActive = activeCategory === item.value || (activeCategory === "" && item.value === "all");

              return (
                <Link
                  key={item.value}
                  href={`/products?category=${item.value}`}
                  aria-label={`Open ${item.label} category`}
                  className={`snap-start shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold leading-none transition ${
                    isActive
                      ? "border-primary bg-primary text-secondary"
                      : "border-primary/18 bg-paper text-primary/85 hover:border-primary/35"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
