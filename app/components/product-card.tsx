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
      className="group relative flex h-[15rem] flex-row overflow-hidden rounded-3xl border border-primary/10 bg-[#fbf5e6] shadow-sm transition duration-300 hover:border-primary/20 hover:shadow-md sm:h-auto sm:flex-col sm:hover:-translate-y-1"
    >
      {isOutOfStock ? (
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-[#fbf5e6]/40 backdrop-grayscale-[0.5]"
          aria-hidden={true}
        />
      ) : null}

      <div className="relative h-full w-[42%] shrink-0 overflow-hidden bg-paper/50 sm:h-auto sm:w-full lg:aspect-[4/4.5] sm:aspect-[4/5]">
        <CloudinaryImage
          src={mainImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent" aria-hidden={true} />

        {pricing.discountPercent > 0 ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-[#faead1] px-2 py-1 text-[0.55rem] font-bold uppercase tracking-wider text-primary shadow-sm sm:bottom-auto sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-[0.65rem]">
            {pricing.discountPercent}% Off
          </span>
        ) : null}

        {isOutOfStock ? (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-primary px-2 py-1 text-[0.55rem] font-bold uppercase tracking-wider text-secondary sm:right-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-[0.65rem]">
            Out of stock
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4.5">
        <div className="flex items-start">
          <span className="line-clamp-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/60 sm:text-[0.65rem] sm:font-bold sm:tracking-[0.2em] sm:text-primary/50">
            {product.categoryValue} <span className="mx-0.5 px-0.5 opacity-50">•</span> {product.subCategoryValue}
          </span>
        </div>

        <div className="mt-1.5 sm:mt-2">
          <h3 className="line-clamp-2 font-display text-[1.1rem] font-medium leading-tight text-primary sm:text-[1.3rem] sm:leading-tight">
            {product.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[0.8rem] leading-snug text-primary/75 sm:mt-1.5 sm:text-[0.85rem] sm:leading-relaxed sm:text-primary/80">
            {product.description}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-primary/80 sm:mt-1.5 sm:gap-2">
            <div className="origin-left scale-[0.85] sm:scale-100"><RatingStars rating={product.rating} /></div>
            <span className="text-[0.65rem] font-medium sm:text-xs">
              {product.rating.toFixed(1)} {hasRatings ? `(${ratingCount})` : ""}
            </span>
          </div>
        </div>

        <div className="mt-0 py-1 sm:mt-2 sm:pt-0">
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
            <button
              type="button"
              aria-label={`Save ${product.name} to wishlist`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-transparent text-primary transition hover:border-primary/40 hover:bg-primary/5 sm:h-10 sm:w-10"
            >
              <DynamicHugeIcon name="FavouriteIcon" className="h-4 w-4 sm:h-4.5 sm:w-4.5" iconStrokeWidth={1.8} aria-hidden={true} />
            </button>

            {quantity > 0 ? (
              <div
                aria-label={`${quantity} of ${product.name} in cart`}
                className="flex h-9 flex-1 items-center justify-between rounded-full bg-primary px-1.5 text-secondary sm:h-10 sm:px-2"
              >
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
              </div>
            ) : (
              <button
                type="button"
                aria-label={`Add ${product.name} to cart`}
                onClick={() => onAddToCart(product.id)}
                disabled={isOutOfStock}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-[0.65rem] font-semibold uppercase tracking-widest text-[#fbf5e6] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45 sm:h-10 sm:gap-2 sm:px-4 sm:text-xs"
              >
                <span className="max-sm:hidden">{isOutOfStock ? "Sold Out" : "Add to cart"}</span>
                <span className="sm:hidden">{isOutOfStock ? "Out of Stock" : "Add to cart"}</span>
                <DynamicHugeIcon name="ShoppingCart02Icon" className="h-3.5 w-3.5 sm:h-4 sm:w-4" iconStrokeWidth={2} aria-hidden={true} />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
