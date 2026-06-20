"use client";

import Link from "next/link";
import { useMemo, memo, type ReactNode } from "react";

import { CloudinaryImage } from "@/app/components/cloudinary-image";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import type { ProductRecord } from "@/lib/appwrite/products";
import { getProductBadgeLabel } from "@/lib/product-badges";

type ProductCardProps = {
  product: ProductRecord;
  index?: number;
  quantity: number;
  onAddToCart: (productId: string) => void;
  onIncreaseQuantity: (productId: string) => void;
  onDecreaseQuantity: (productId: string) => void;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
};

// Memoize the price formatter for performance
const priceFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

function calculateDiscount(discountPrice: number, originalPrice: number): number {
  if (originalPrice <= 0 || discountPrice <= 0 || discountPrice >= originalPrice) {
    return 0;
  }

  return Math.round(((originalPrice - discountPrice) / originalPrice) * 100);
}

function getPricingSummary(product: ProductRecord): {
  hasSale: boolean;
  effectivePrice: number;
  strikePrice: number;
  savingsAmount: number;
  discountPercent: number;
} {
  const originalPrice = Number.isFinite(product.originalPrice) ? Math.max(0, product.originalPrice) : 0;
  const discountPrice = Number.isFinite(product.discountPrice) ? Math.max(0, product.discountPrice) : 0;

  const hasSale = originalPrice > 0 && discountPrice > 0 && discountPrice < originalPrice;
  const effectivePrice = hasSale
    ? discountPrice
    : originalPrice > 0
      ? originalPrice
      : discountPrice > 0
        ? discountPrice
        : 0;

  return {
    hasSale,
    effectivePrice,
    strikePrice: hasSale ? originalPrice : 0,
    savingsAmount: hasSale ? originalPrice - discountPrice : 0,
    discountPercent: hasSale ? calculateDiscount(discountPrice, originalPrice) : 0,
  };
}

function RatingStars({ rating }: { rating: number }): ReactNode {
  const safeRating = Math.max(0, Math.min(5, rating));

  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Rated ${safeRating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fillRatio = Math.max(0, Math.min(1, safeRating - index));
        const fillPercentage = Math.round(fillRatio * 100);

        return (
          <span key={`rating-star-${index}`} className="relative block h-3.5 w-3.5 shrink-0" aria-hidden={true}>
            <DynamicHugeIcon
              name="StarIcon"
              className="absolute inset-0 h-3.5 w-3.5 text-primary/25"
              iconStrokeWidth={1.8}
            />
            {fillPercentage > 0 ? (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                // The aggregate is runtime data, so Tailwind cannot express this fractional width statically.
                style={{ width: `${fillPercentage}%` }}
              >
                <DynamicHugeIcon
                  name="StarIcon"
                  className="h-3.5 w-3.5 max-w-none fill-primary text-primary"
                  fill="currentColor"
                  iconStrokeWidth={1.8}
                />
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function ProductCardInternal({
  product,
  quantity,
  onAddToCart,
  onIncreaseQuantity,
  onDecreaseQuantity,
  isWishlisted,
  onToggleWishlist,
}: Omit<ProductCardProps, "index">): ReactNode {
  const pricing = useMemo(() => getPricingSummary(product), [product]);
  const ratingCount = Math.max(0, Math.trunc(product.ratingCount));
  const hasRatings = ratingCount > 0;
  const isOutOfStock = product.stockQty <= 0;
  const mainImage = product.mainImageUrl || product.otherImageUrls[0] || "/logo4.png";
  const productHref = `/products/${product.category}/${product.subCategory}/${product.slug}`;
  const badgeLabel = getProductBadgeLabel(product.badge);

  return (
    <article className="group relative flex h-[15rem] flex-row overflow-hidden rounded-3xl border border-primary/10 bg-[#fbf5e6] shadow-sm transition duration-300 hover:border-primary/20 hover:shadow-md sm:h-full sm:flex-col sm:hover:sm:-translate-y-1">
      <button
        type="button"
        aria-label={`${isWishlisted ? "Remove" : "Save"} ${product.name} ${isWishlisted ? "from" : "to"} wishlist`}
        onClick={() => onToggleWishlist(product.id)}
        className={`absolute right-2.5 top-2.5 z-[4] flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition sm:right-4 sm:top-4 ${
          isWishlisted
            ? "border-primary bg-primary text-secondary shadow-[0_10px_24px_rgba(120,0,0,0.24)]"
            : "border-primary/25 bg-secondary/80 text-primary hover:border-primary/45 hover:bg-secondary"
        }`}
      >
        <DynamicHugeIcon
          name="FavouriteIcon"
          className={`h-4.5 w-4.5 transition-colors ${isWishlisted ? "fill-secondary" : "fill-none"}`}
          fill={isWishlisted ? "currentColor" : "none"}
          iconStrokeWidth={2}
          aria-hidden={true}
        />
      </button>

      {isOutOfStock ? (
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-[#fbf5e6]/40 backdrop-grayscale-[0.5]"
          aria-hidden={true}
        />
      ) : null}

      <div className="relative h-full w-[42%] shrink-0 overflow-hidden bg-paper/50 sm:h-auto sm:w-full lg:aspect-[4/4.5] sm:aspect-[4/5]">
        <Link href={productHref} aria-label={`Open ${product.name}`} className="absolute inset-0 z-[1]">
          <CloudinaryImage
            src={mainImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-500 sm:group-hover:scale-105"
          />
        </Link>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-24 bg-gradient-to-t from-black/20 to-transparent" aria-hidden={true} />

        {pricing.discountPercent > 0 ? (
          <span className="pointer-events-none absolute bottom-2.5 left-2.5 z-[3] rounded-full bg-[#faead1] px-2 py-1 text-[0.55rem] font-bold uppercase tracking-wider text-primary shadow-sm sm:bottom-auto sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-[0.65rem]">
            {pricing.discountPercent}% Off
          </span>
        ) : null}
        {badgeLabel ? (
          <span className="pointer-events-none absolute left-2.5 top-2.5 z-[3] max-w-[calc(100%-3.5rem)] rounded-full border border-secondary/35 bg-primary/90 px-2 py-1 text-[0.52rem] font-bold uppercase tracking-[0.1em] text-secondary shadow-sm sm:left-4 sm:top-auto sm:bottom-4 sm:px-3 sm:py-1.5 sm:text-[0.62rem]">
            {badgeLabel}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3.5 sm:p-4.5">
        <div className="flex items-start sm:min-h-4">
          <span className="line-clamp-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/60 sm:text-[0.65rem] sm:font-bold sm:tracking-[0.2em] sm:text-primary/50">
            {product.categoryValue} <span className="mx-0.5 px-0.5 opacity-50">•</span> {product.subCategoryValue}
          </span>
        </div>

        <div className="mt-1.5 flex min-h-0 flex-1 flex-col sm:mt-2">
          <Link href={productHref} aria-label={`Open ${product.name}`} className="inline-block sm:h-[3.35rem]">
            <h3 className="block line-clamp-2 max-h-[2.75rem] overflow-hidden font-display text-[1.1rem] font-medium leading-tight text-primary transition hover:text-primary/90 sm:max-h-[3.35rem] sm:text-[1.3rem] sm:leading-tight">
              {product.name}
            </h3>
          </Link>
          <p className="mt-1.5 line-clamp-2 text-[0.8rem] leading-snug text-primary/75 sm:h-[2.8rem] sm:text-[0.85rem] sm:leading-relaxed sm:text-primary/80">
            {product.description}
          </p>
          <div className="mt-1 min-h-[1.05rem] sm:mt-1.5 sm:min-h-[1.25rem]">
            {hasRatings ? (
              <div className="flex items-center gap-1.5 text-primary/80 sm:gap-2">
                <div className="origin-left scale-[0.85] sm:scale-100">
                  <RatingStars rating={product.rating} />
                </div>
                <span className="text-[0.65rem] font-medium sm:text-xs">
                  {product.rating.toFixed(1)} ({ratingCount})
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto py-1 sm:pt-2">
          <div className="flex items-baseline gap-2 sm:gap-2.5">
            <span className="text-[1rem] font-semibold sm:font-medium tracking-wide text-primary/95 sm:text-[1.1rem]">
              {pricing.effectivePrice > 0 ? formatPrice(pricing.effectivePrice) : "Price on request"}
            </span>
            {pricing.strikePrice > 0 ? (
              <span className="text-[0.7rem] text-primary/45 line-through sm:text-[0.85rem] sm:font-medium">
                {formatPrice(pricing.strikePrice)}
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex items-center gap-2 sm:mt-3.5 sm:gap-3">
            <div className={`flex h-9 flex-1 items-center ${quantity > 0 ? 'justify-between rounded-full bg-primary px-1.5 text-secondary sm:h-10 sm:px-2' : 'justify-center'}`}>
              {quantity > 0 ? (
                <>
                  <button
                    type="button"
                    aria-label={`Decrease ${product.name} quantity`}
                    onClick={() => onDecreaseQuantity(product.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/15 transition hover:bg-secondary/25 sm:h-7 sm:w-7"
                  >
                    <DynamicHugeIcon name="Remove01Icon" className="h-3 w-3 sm:h-3.5 sm:w-3.5" iconStrokeWidth={2} aria-hidden={true} />
                  </button>
                  <span className="text-xs font-semibold sm:text-sm">{quantity}</span>
                  <button
                    type="button"
                    aria-label={`Increase ${product.name} quantity`}
                    onClick={() => onIncreaseQuantity(product.id)}
                    disabled={isOutOfStock}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/15 transition hover:bg-secondary/25 disabled:cursor-not-allowed disabled:opacity-45 sm:h-7 sm:w-7"
                  >
                    <DynamicHugeIcon name="Add01Icon" className="h-3 w-3 sm:h-3.5 sm:w-3.5" iconStrokeWidth={2} aria-hidden={true} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  aria-label={`Add ${product.name} to cart`}
                  onClick={() => onAddToCart(product.id)}
                  disabled={isOutOfStock}
                  className="flex h-full w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-[0.65rem] font-semibold uppercase tracking-widest text-[#fbf5e6] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45 sm:gap-2 sm:px-4 sm:text-xs"
                >
                  <span className="max-sm:hidden">{isOutOfStock ? "Out Of Stock" : "Add to cart"}</span>
                  <span className="sm:hidden">{isOutOfStock ? "Out of Stock" : "Add to cart"}</span>
                  <DynamicHugeIcon name="ShoppingCart02Icon" className="h-3.5 w-3.5 sm:h-4 sm:w-4" iconStrokeWidth={2} aria-hidden={true} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export const ProductCard = memo(ProductCardInternal);
