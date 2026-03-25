"use client";

import { motion } from "framer-motion";

import { CloudinaryImage } from "@/app/components/cloudinary-image";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import type { ProductRecord } from "@/lib/appwrite/products";

type ProductCardProps = {
  product: ProductRecord;
  index?: number;
  quantity: number;
  onAddToCart: (productId: string) => void;
  onIncreaseQuantity: (productId: string) => void;
  onDecreaseQuantity: (productId: string) => void;
};

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

function getPricingSummary(product: ProductRecord) {
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

function RatingStars({ rating }: { rating: number }) {
  const safeRating = Math.max(0, Math.min(5, rating));
  const ratedStars = Math.floor(safeRating);

  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Rated ${safeRating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        if (index < ratedStars) {
          return <DynamicHugeIcon key={`star-full-${index}`} name="StarIcon" className="h-3.5 w-3.5 text-primary" iconStrokeWidth={1.8} aria-hidden={true} />;
        }

        return <DynamicHugeIcon key={`star-empty-${index}`} name="StarIcon" className="h-3.5 w-3.5 text-primary/25" iconStrokeWidth={1.8} aria-hidden={true} />;
      })}
    </div>
  );
}

export function ProductCard({
  product,
  index = 0,
  quantity,
  onAddToCart,
  onIncreaseQuantity,
  onDecreaseQuantity,
}: ProductCardProps) {
  const pricing = getPricingSummary(product);
  const ratingCount = Math.max(0, Math.trunc(product.ratingCount));
  const hasRatings = ratingCount > 0 || product.rating > 0;
  const isOutOfStock = product.stockQty <= 0;
  const mainImage = product.mainImageUrl || product.otherImageUrls[0] || "/logo4.png";

  return (
    <motion.article
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.46, delay: Math.min(index * 0.05, 0.28), ease: cardEase }}
      className="group relative flex min-h-[320px] overflow-hidden rounded-[1.7rem] border border-primary/15 bg-secondary/95 shadow-[0_14px_36px_rgba(120,0,0,0.10)] transition duration-300 hover:border-primary/30 hover:shadow-[0_22px_44px_rgba(120,0,0,0.16)] sm:block sm:min-h-0 sm:hover:-translate-y-1"
    >
      {isOutOfStock ? (
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-paper/28 backdrop-grayscale-[0.22]"
          aria-hidden={true}
        />
      ) : null}

      <div className="relative h-[40vh] min-h-[320px] w-[43%] shrink-0 overflow-hidden sm:h-auto sm:min-h-0 sm:w-full sm:aspect-[4/5]">
        <CloudinaryImage
          src={mainImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" aria-hidden={true} />

        {pricing.discountPercent > 0 ? (
          <span className="absolute bottom-3 left-3 rounded-full border border-primary/15 bg-secondary/90 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-primary shadow-sm backdrop-blur-sm sm:bottom-auto sm:top-3 sm:bg-secondary/95 sm:backdrop-blur-0">
            {pricing.discountPercent}% Off
          </span>
        ) : null}

        {isOutOfStock ? (
          <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-secondary">
            Out of stock
          </span>
        ) : null}

        {/*
        <p className="absolute bottom-3 left-3 rounded-md bg-black/40 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-secondary/95">
          SKU {product.sku || "N/A"}
        </p>
        */}
      </div>

      <div className="flex h-[40vh] min-h-[320px] flex-1 flex-col p-3.5 sm:h-auto sm:min-h-0 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 rounded-full border border-primary/15 bg-paper px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/70">
            {product.categoryValue} · {product.subCategoryValue}
          </p>
        </div>

        <div className="mt-3 space-y-1.5">
          <h3 className="line-clamp-2 text-xl font-semibold leading-tight text-primary">{product.name}</h3>
          <p className="line-clamp-3 text-sm leading-relaxed text-primary/75 sm:line-clamp-2">{product.description}</p>
          <div className="flex items-center gap-2 pt-0.5 text-primary/80">
            <RatingStars rating={product.rating} />
            {hasRatings ? (
              <p className="text-xs font-semibold">
                {product.rating.toFixed(1)} ({ratingCount})
              </p>
            ) : (
              <p className="text-xs font-semibold text-primary/60">No ratings yet</p>
            )}
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-primary/12 bg-gradient-to-r from-paper via-secondary to-paper px-3 py-2.5 sm:px-3.5 sm:py-3">
          <div className="flex items-start justify-between gap-3 sm:items-end">
            <p className="text-[1.24rem] font-semibold leading-none text-primary sm:text-[1.08rem]">
              {pricing.effectivePrice > 0 ? formatPrice(pricing.effectivePrice) : "Price on request"}
            </p>
            {pricing.strikePrice > 0 ? (
              <p className="pb-0.5 text-[11px] text-primary/50 line-through">{formatPrice(pricing.strikePrice)}</p>
            ) : null}
          </div>
          {pricing.savingsAmount > 0 ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">You save {formatPrice(pricing.savingsAmount)}</p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <button
            type="button"
            aria-label={`Save ${product.name} to wishlist`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-paper text-primary transition hover:border-primary/40 hover:bg-secondary"
          >
            <DynamicHugeIcon name="FavouriteIcon" className="h-4.5 w-4.5" iconStrokeWidth={1.9} aria-hidden={true} />
          </button>

          {quantity > 0 ? (
            <div
              aria-label={`${quantity} of ${product.name} in cart`}
              className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary px-2 py-1.5 text-secondary"
            >
              <button
                type="button"
                aria-label={`Decrease ${product.name} quantity`}
                onClick={() => onDecreaseQuantity(product.id)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-secondary/35 bg-primary/70 transition hover:bg-primary/85"
              >
                <DynamicHugeIcon name="Remove01Icon" className="h-3.5 w-3.5" iconStrokeWidth={2} aria-hidden={true} />
              </button>
              <span className="inline-flex min-w-5 items-center justify-center text-xs font-semibold">{quantity}</span>
              <button
                type="button"
                aria-label={`Increase ${product.name} quantity`}
                onClick={() => onIncreaseQuantity(product.id)}
                disabled={isOutOfStock}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-secondary/35 bg-primary/70 transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <DynamicHugeIcon name="Add01Icon" className="h-3.5 w-3.5" iconStrokeWidth={2} aria-hidden={true} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label={`Add ${product.name} to cart`}
              onClick={() => onAddToCart(product.id)}
              disabled={isOutOfStock}
              className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-secondary transition hover:-translate-y-0.5 hover:bg-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:bg-primary disabled:hover:text-secondary"
            >
              {isOutOfStock ? "Sold Out" : "Add to cart"}
              <DynamicHugeIcon name="ShoppingCart02Icon" className="h-3.5 w-3.5" iconStrokeWidth={2} aria-hidden={true} />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
