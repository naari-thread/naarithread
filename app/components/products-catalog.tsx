"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import { CloudinaryImage } from "@/app/components/cloudinary-image";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import type { ProductRecord } from "@/lib/appwrite/products";

type ProductCategory = {
  label: string;
  value: string;
};

type ProductsCatalogProps = {
  products: ProductRecord[];
  activeCategory: string;
};

const productCategories: ProductCategory[] = [
  { label: "All", value: "" },
  { label: "Ethnic", value: "ethnic-wear" },
  { label: "Western", value: "western-wear" },
  { label: "Bottom", value: "bottom-wear" },
  { label: "Fusion", value: "fusion-wear" },
];

const cardEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function calculateDiscount(discountPrice: number, originalPrice: number) {
  if (originalPrice <= 0 || discountPrice <= 0 || discountPrice >= originalPrice) {
    return 0;
  }

  return Math.round(((originalPrice - discountPrice) / originalPrice) * 100);
}

function getCategoryHref(category: string) {
  const params = new URLSearchParams();
  if (category) {
    params.set("category", category);
  }

  const suffix = params.toString();
  return suffix ? `/products?${suffix}` : "/products";
}

export function ProductsCatalog({ products, activeCategory }: ProductsCatalogProps) {
  const [searchText, setSearchText] = useState("");

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return products;
    }

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.sku.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [products, searchText]);

  return (
    <>
      <section className="mx-auto w-full max-w-7xl">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.26em] text-primary/60">Products</p>
            <h1 className="mt-1 font-display text-3xl leading-tight sm:text-4xl">Shop The Collection</h1>
          </div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-primary/60 sm:block">
            {filteredProducts.length} result{filteredProducts.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[1.25rem] border border-primary/15 bg-gradient-to-br from-secondary via-paper to-secondary p-3 shadow-[0_14px_36px_rgba(120,0,0,0.10)] sm:p-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" aria-hidden={true} />

          <div className="relative flex items-center gap-3">
            <label
              htmlFor="products-search"
              className="group flex h-12 flex-1 items-center gap-2.5 rounded-2xl border border-primary/12 bg-secondary/70 px-3.5"
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
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search by name, SKU, or category"
                className="w-full bg-transparent text-[0.98rem] text-primary placeholder:text-primary/65 outline-none"
              />
            </label>

            <button
              type="button"
              aria-label="Open product filters"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-secondary/70 text-primary transition hover:border-primary/40 hover:bg-secondary"
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
            {productCategories.map((item) => {
              const isActive = activeCategory === item.value || (activeCategory === "" && item.value === "");

              return (
                <Link
                  key={item.value || "all"}
                  href={getCategoryHref(item.value)}
                  aria-label={`Open ${item.label} category`}
                  className={`snap-start shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold leading-none transition ${
                    isActive
                      ? "border-primary bg-primary text-secondary"
                      : "border-primary/18 bg-secondary/70 text-primary/85 hover:border-primary/35 hover:bg-secondary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 w-full max-w-7xl">
        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-primary/15 bg-secondary/90 p-7 text-center text-primary shadow-[0_12px_30px_rgba(120,0,0,0.08)] sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary/65">No products found</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Try another search or category</h2>
            <p className="mt-3 text-sm text-primary/75 sm:text-base">No matching products are available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product, index) => {
              const discountPercent = calculateDiscount(product.discountPrice, product.originalPrice);

              return (
                <motion.article
                  key={product.id}
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.46, delay: Math.min(index * 0.05, 0.28), ease: cardEase }}
                  className="group relative overflow-hidden rounded-3xl border border-primary/15 bg-secondary/95 shadow-[0_14px_36px_rgba(120,0,0,0.10)] transition hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(120,0,0,0.16)]"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <CloudinaryImage
                      src={product.mainImageUrl}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />

                    {discountPercent > 0 ? (
                      <span className="absolute left-3 top-3 rounded-full border border-primary/20 bg-secondary px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-primary shadow-sm">
                        {discountPercent}% Off
                      </span>
                    ) : null}

                    {product.stockQty <= 0 ? (
                      <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-secondary">
                        Sold Out
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="space-y-1">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary/60">{product.category}</p>
                      <h3 className="line-clamp-2 text-xl font-semibold leading-tight text-primary">{product.name}</h3>
                    </div>

                    <p className="line-clamp-2 text-sm text-primary/75">{product.description}</p>

                    <div className="flex items-end gap-2">
                      <p className="text-lg font-semibold text-primary">{formatPrice(product.discountPrice)}</p>
                      {product.originalPrice > product.discountPrice ? (
                        <p className="pb-0.5 text-sm text-primary/50 line-through">{formatPrice(product.originalPrice)}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        aria-label={`Add ${product.name} to cart`}
                        className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-secondary transition hover:-translate-y-0.5 hover:bg-secondary hover:text-primary"
                      >
                        Add
                        <DynamicHugeIcon name="ShoppingCart01Icon" className="h-3.5 w-3.5" iconStrokeWidth={2} aria-hidden={true} />
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
