import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getProductBySlug } from "@/lib/appwrite/products";
import { getCategoryForSubCategory, getCategoryLabelBySlug, getSubCategoryLabelBySlug, isProductCategorySlug, isProductSubCategorySlug } from "@/lib/product-taxonomy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductDetailsPageProps = {
  params: Promise<{ category: string; subcategory: string; productSlug: string }>;
};

export async function generateMetadata({ params }: ProductDetailsPageProps): Promise<Metadata> {
  const { productSlug } = await params;
  const product = await getProductBySlug(productSlug);

  if (!product) {
    return {};
  }

  return {
    title: product.name,
    description: product.description,
    alternates: {
      canonical: `/products/${product.category}/${product.subCategory}/${product.slug}`,
    },
    openGraph: {
      title: product.name,
      description: product.description,
      images: product.mainImageUrl ? [{ url: product.mainImageUrl, alt: product.name }] : undefined,
    },
  };
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const { category, subcategory, productSlug } = await params;

  if (!isProductCategorySlug(category) || !isProductSubCategorySlug(subcategory)) {
    notFound();
  }

  if (getCategoryForSubCategory(subcategory) !== category) {
    notFound();
  }

  const product = await getProductBySlug(productSlug);
  if (!product || product.category !== category || product.subCategory !== subcategory) {
    notFound();
  }

  const image = product.mainImageUrl || product.otherImageUrls[0] || "/logo4.png";
  const sellingPrice = product.discountPrice > 0 ? product.discountPrice : product.originalPrice;

  return (
    <main className="min-h-screen bg-paper px-4 pb-20 pt-24 text-primary sm:px-6 md:px-8 md:pt-30">
      <section className="mx-auto w-full max-w-6xl">
        <div className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-primary/62">
          <Link href="/products" aria-label="Open products page" className="transition hover:text-primary">
            Shop
          </Link>{" "}
          /{" "}
          <Link href={`/products/${category}`} aria-label={`Open ${getCategoryLabelBySlug(category)}`} className="transition hover:text-primary">
            {getCategoryLabelBySlug(category)}
          </Link>{" "}
          /{" "}
          <Link href={`/products/${category}/${subcategory}`} aria-label={`Open ${getSubCategoryLabelBySlug(subcategory)}`} className="transition hover:text-primary">
            {getSubCategoryLabelBySlug(subcategory)}
          </Link>
        </div>

        <article className="grid grid-cols-1 gap-6 rounded-3xl border border-primary/14 bg-secondary p-4 shadow-[0_14px_34px_rgba(120,0,0,0.08)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-8 md:p-6">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-primary/12 bg-paper">
            <Image
              src={image}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-primary/62">
              {product.categoryValue} • {product.subCategoryValue}
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">{product.name}</h1>
            <p className="mt-4 text-sm leading-relaxed text-primary/80 sm:text-base">{product.description}</p>

            <div className="mt-5 flex items-end gap-3">
              <span className="text-3xl font-semibold text-primary">{formatPrice(sellingPrice)}</span>
              {product.originalPrice > sellingPrice ? (
                <span className="pb-1 text-base text-primary/52 line-through">{formatPrice(product.originalPrice)}</span>
              ) : null}
            </div>

            <p className="mt-3 text-sm text-primary/75">
              {product.stockQty > 0 ? `${product.stockQty} in stock` : "Out Of Stock"}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={`/products/${category}/${subcategory}`}
                aria-label="Back to category"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/20 bg-paper px-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary transition hover:border-primary/45"
              >
                Back to Products
              </Link>
              <Link
                href="/cart"
                aria-label="Open cart"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.18em] text-secondary transition hover:bg-primary/90"
              >
                Go to Cart
              </Link>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
