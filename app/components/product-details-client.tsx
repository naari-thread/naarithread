"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { AuthModal } from "@/app/components/auth-modal";
import { useAuth } from "@/app/components/auth-provider";
import { CloudinaryImage } from "@/app/components/cloudinary-image";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { upsertUserCartMap } from "@/lib/appwrite/shop-sync";
import {
  type CartItemsMap,
  readCartItems,
  writeCartItemSelection,
  writeCartItems,
  subscribeToCartChanges,
} from "@/lib/cart-state";
import type { ProductRecord } from "@/lib/appwrite/products";
import {
  createProductReview,
  listProductReviews,
  type ProductReview,
} from "@/lib/appwrite/reviews";
import { uploadImageToCloudinary } from "@/lib/cloudinary-upload-client";
import {
  readWishlistItems,
  toggleWishlistItem,
  subscribeToWishlistChanges,
  type WishlistItemsMap,
} from "@/lib/wishlist-state";

type ProductDetailsClientProps = {
  product: ProductRecord;
  category: string;
  categoryLabel: string;
  subCategoryLabel: string;
  relatedProducts: ProductRecord[];
};

type ReviewSpotlightItem = {
  id: string;
  title: string;
  comment: string;
  author: string;
  dateLabel: string;
  rating: number;
  verified: boolean;
  isAggregate: boolean;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getProductPrice(product: ProductRecord) {
  return product.discountPrice > 0
    ? product.discountPrice
    : product.originalPrice;
}

function deterministicInt(
  id: string,
  salt: number,
  min: number,
  max: number,
): number {
  let h = salt * 2654435761;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 2246822519) | 0;
  }
  return min + (Math.abs(h) % (max - min + 1));
}

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function ProductDetailsClient({
  product,
  category,
  categoryLabel,
  subCategoryLabel,
  relatedProducts,
}: ProductDetailsClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, createAuthJwt, normalizeError } =
    useAuth();

  const galleryImages = useMemo(() => {
    const imagePool = [product.mainImageUrl, ...product.otherImageUrls]
      .map((value) => value.trim())
      .filter(Boolean);

    const unique = Array.from(new Set(imagePool));
    return unique.length > 0 ? unique : ["/logo4.png"];
  }, [product.mainImageUrl, product.otherImageUrls]);

  const sellingPrice = getProductPrice(product);
  const isDiscounted =
    product.originalPrice > sellingPrice && product.originalPrice > 0;
  const discountPercent = isDiscounted
    ? Math.round(
        ((product.originalPrice - sellingPrice) / product.originalPrice) * 100,
      )
    : 0;

  const [activeImage, setActiveImage] = useState<string>(
    galleryImages[0] ?? "/logo4.png",
  );
  const [activeSize, setActiveSize] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<string | null>(
    product.colorOptions[0] ?? null,
  );
  const [cartActionError, setCartActionError] = useState("");

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [reviewError, setReviewError] = useState("");
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [hoveredReviewRating, setHoveredReviewRating] = useState<number | null>(
    null,
  );
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [supportsHover, setSupportsHover] = useState(false);
  const [isReviewsSectionVisible, setIsReviewsSectionVisible] = useState(false);

  // Zoom state (desktop hover zoom)
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isZooming, setIsZooming] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Mobile carousel state
  const [mobileCarouselIndex, setMobileCarouselIndex] = useState(0);
  const mobileCarouselRef = useRef<HTMLDivElement>(null);

  // Mobile viewer state
  const [pinchScale, setPinchScale] = useState(1);
  const lastTapRef = useRef<number>(0);
  const swipeStartRef = useRef<number | null>(null);

  // Urgency visibility
  const [urgencyVisible, setUrgencyVisible] = useState(false);

  // Review image upload state
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewImagePreviews, setReviewImagePreviews] = useState<string[]>([]);
  const [reviewSpotlightIndex, setReviewSpotlightIndex] = useState(0);

  const [wishlistItems, setWishlistItems] = useState<WishlistItemsMap>(() =>
    readWishlistItems(),
  );

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setWishlistItems(readWishlistItems());
    });

    const unsubscribe = subscribeToWishlistChanges(setWishlistItems);

    return () => {
      window.cancelAnimationFrame(frameId);
      unsubscribe();
    };
  }, []);

  const [cartItems, setCartItems] = useState<CartItemsMap>(() =>
    readCartItems(),
  );

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setCartItems(readCartItems());
    });

    const unsubscribe = subscribeToCartChanges(setCartItems);

    return () => {
      window.cancelAnimationFrame(frameId);
      unsubscribe();
    };
  }, []);

  const isWishlisted = !!wishlistItems[product.id];
  const isAddedToCart = !!cartItems[product.id] && cartItems[product.id] > 0;

  // Urgency numbers — deterministic per product id
  const urgencyViewersBase = deterministicInt(product.id, 1, 5, 15);
  const [liveViewers, setLiveViewers] = useState(urgencyViewersBase);

  useEffect(() => {
    if (!urgencyVisible) return;
    const interval = setInterval(() => {
      setLiveViewers((prev) => {
        const changes = [-3, -2, -1, 1, 2, 3, 4];
        const change = changes[Math.floor(Math.random() * changes.length)];
        const next = prev + change;
        return next >= 5 && next <= 40 ? next : prev;
      });
    }, 4500);
    return () => clearInterval(interval);
  }, [urgencyVisible]);

  const ratingSource =
    reviews.length > 0
      ? reviews
      : product.ratingCount > 0
        ? [
            {
              id: "aggregate-fallback",
              productId: product.id,
              userId: "",
              userName: "",
              userEmail: "",
              rating: product.rating,
              title: "",
              comment: "",
              isVerifiedPurchase: true,
              isApproved: true,
              createdAt: "",
            },
          ]
        : [];

  const averageRating =
    ratingSource.length > 0
      ? ratingSource.reduce((sum, item) => sum + item.rating, 0) /
        ratingSource.length
      : 0;
  const reviewCount = reviews.length > 0 ? reviews.length : product.ratingCount;

  const reviewSpotlightItems = useMemo<ReviewSpotlightItem[]>(() => {
    if (reviews.length > 0) {
      return reviews.slice(0, 4).map((review) => ({
        id: review.id,
        title: review.title.trim() || "Customer review",
        comment: review.comment.trim() || "Shared from a verified buyer.",
        author: review.userName.trim() || "Guest",
        dateLabel: formatReviewDate(review.createdAt),
        rating: review.rating,
        verified: review.isVerifiedPurchase,
        isAggregate: false,
      }));
    }

    if (product.ratingCount > 0) {
      return [
        {
          id: "aggregate-review-spotlight",
          title: `${averageRating.toFixed(1)} average rating`,
          comment: `Based on ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"} from customers who already bought this piece.`,
          author: product.name,
          dateLabel: "Customer rating",
          rating: product.rating,
          verified: true,
          isAggregate: true,
        },
      ];
    }

    return [
      {
        id: "no-review-spotlight",
        title: `Be the first to review ${product.name}`,
        comment:
          "The spotlight will rotate through customer feedback here once approved reviews are available.",
        author: "NaariThread",
        dateLabel: "Reviews",
        rating: 0,
        verified: false,
        isAggregate: true,
      },
    ];
  }, [averageRating, product.name, product.rating, product.ratingCount, reviewCount, reviews]);

  useEffect(() => {
    setReviewSpotlightIndex(0);
  }, [reviewSpotlightItems.length]);

  useEffect(() => {
    if (reviewSpotlightItems.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setReviewSpotlightIndex((previous) => {
        const next = previous + 1;
        return next >= reviewSpotlightItems.length ? 0 : next;
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [reviewSpotlightItems.length]);

  const activeReviewSpotlight =
    reviewSpotlightItems[reviewSpotlightIndex] ?? reviewSpotlightItems[0];

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const media = window.matchMedia("(hover: hover) and (pointer: fine)");
      setSupportsHover(media.matches);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  // Urgency entrance animation — delayed 1.1s after mount
  useEffect(() => {
    const t = window.setTimeout(() => setUrgencyVisible(true), 1100);
    return () => window.clearTimeout(t);
  }, []);

  // Track mobile carousel scroll position for indicator
  useEffect(() => {
    const carousel = mobileCarouselRef.current;
    if (!carousel) return;

    const handleScroll = () => {
      const scrollLeft = carousel.scrollLeft;
      const itemWidth = carousel.scrollWidth / galleryImages.length;
      const index = Math.round(scrollLeft / itemWidth);
      const nextIndex = Math.max(0, Math.min(index, galleryImages.length - 1));
      setMobileCarouselIndex(nextIndex);
      setActiveImage(galleryImages[nextIndex] ?? galleryImages[0] ?? "/logo4.png");
    };

    carousel.addEventListener("scroll", handleScroll);
    return () => carousel.removeEventListener("scroll", handleScroll);
  }, [galleryImages, galleryImages.length]);

  useEffect(() => {
    let alive = true;

    const frameId = window.requestAnimationFrame(() => {
      setIsReviewsLoading(true);
      setReviewError("");
    });

    const loadReviews = async () => {
      try {
        const jwt = isAuthenticated ? await createAuthJwt() : undefined;
        const response = await listProductReviews(product.id, jwt, [
          product.sku,
          product.slug,
        ]);
        if (!alive) {
          return;
        }

        setReviews(response);
      } catch (error) {
        if (!alive) {
          return;
        }

        setReviewError(normalizeError(error));
      } finally {
        if (!alive) {
          return;
        }

        setIsReviewsLoading(false);
      }
    };

    void loadReviews();

    return () => {
      alive = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [
    createAuthJwt,
    isAuthenticated,
    normalizeError,
    product.id,
    product.slug,
    product.sku,
  ]);

  const handleReviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAuthenticated || !user?.$id) {
      setIsAuthModalOpen(true);
      return;
    }

    const safeComment = reviewDraft.trim();
    if (!safeComment) {
      setReviewError("Please write your review before submitting.");
      return;
    }

    setIsSubmittingReview(true);
    setReviewError("");

    try {
      const jwt = await createAuthJwt();

      // Upload any attached images to Cloudinary first, then persist their URLs.
      const imageUrls: string[] = [];
      for (const file of reviewImages.slice(0, 3)) {
        imageUrls.push(await uploadImageToCloudinary(file, "review", jwt));
      }

      const createdReview = await createProductReview({
        jwt,
        productId: product.id,
        productAliases: [product.sku, product.slug, product.id],
        userId: user.$id,
        userName: user.name?.trim() || user.email.split("@")[0] || "Customer",
        userEmail: user.email,
        rating: reviewRating,
        comment: safeComment,
        imageUrls,
      });

      setReviews((previous) => [createdReview, ...previous]);
      setReviewDraft("");
      setReviewRating(0);
      setHoveredReviewRating(null);
      setReviewImages([]);
      setReviewImagePreviews([]);
    } catch (error) {
      setReviewError(normalizeError(error));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleReviewImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = 3 - reviewImages.length;
    if (remaining <= 0) return;
    const selected = files.slice(0, remaining);
    setReviewImages((prev) => [...prev, ...selected]);
    selected.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setReviewImagePreviews((prev) => [
          ...prev,
          ev.target?.result as string,
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeReviewImage = (index: number) => {
    setReviewImages((prev) => prev.filter((_, i) => i !== index));
    setReviewImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} on Naarithread!`,
          url: window.location.href,
        });
      } catch (err) {
        if (
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && /abort|cancel/i.test(err.message))
        ) {
          return;
        }

        console.error("Error sharing:", err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      } catch (err) {
        console.error("Copy failed:", err);
      }
    }
  };

  useEffect(() => {
    const el = document.getElementById("reviews");
    if (!el) return;

    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      // Show when the top of the reviews section goes above the middle of the viewport
      // Adjust this as needed for the desired "half part is gone" effect
      setIsReviewsSectionVisible(rect.top < -20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initially

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAddToCart = async () => {
    if (product.sizeOptions.length > 0 && !activeSize) {
      setCartActionError("Select a size to add to cart.");
      return;
    }

    setCartActionError("");

    const current = readCartItems();
    const currentQuantity = Math.max(0, Math.trunc(current[product.id] ?? 0));
    const next = {
      ...current,
      [product.id]: currentQuantity + 1,
    };

    writeCartItems(next);
    writeCartItemSelection(product.id, {
      ...(activeSize ? { size: activeSize } : {}),
      ...(activeColor ? { color: activeColor } : {}),
    });

    if (!isAuthenticated || !user?.$id) {
      return;
    }

    try {
      const jwt = await createAuthJwt();
      await upsertUserCartMap(jwt, user.$id, next);
    } catch {
      // Keep local add-to-cart experience instant even if cloud sync fails.
    }
  };

  return (
    <>
      <main className="min-h-screen bg-paper pb-32 pt- text-primary sm:pt-16 md:pb-14 md:pt-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs - Moved to top, usable links */}
          <nav
            aria-label="Breadcrumb"
            className="mb-5 hidden items-center gap-2.5 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary/50 md:flex"
          >
            <Link
              href="/products"
              className="transition-colors hover:text-primary hover:underline underline-offset-4 decoration-primary/30"
            >
              Shop
            </Link>
            <DynamicHugeIcon
              name="ArrowRight01Icon"
              className="h-3 w-3 opacity-40"
            />
            <Link
              href={`/products/${category}`}
              className="transition-colors hover:text-primary hover:underline underline-offset-4 decoration-primary/30"
            >
              {categoryLabel}
            </Link>
            <DynamicHugeIcon
              name="ArrowRight01Icon"
              className="h-3 w-3 opacity-40"
            />
            <span className="text-primary">{subCategoryLabel}</span>
          </nav>

          {/* Product Inner Grid */}
          {reviews.length > 0 && (
            <div className=" mb-4 overflow-hidden rounded-2xl border border-primary/10 bg-secondary/70 shadow-[0_8px_18px_rgba(80,30,20,0.05)] md:mb-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeReviewSpotlight.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-2.5 px-3.5 py-3 sm:px-4 sm:py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="inline-flex items-center gap-2">
                        <div
                          className="inline-flex items-center gap-0.5"
                          aria-label={`Rated ${Math.max(0, activeReviewSpotlight.rating).toFixed(1)} out of 5`}
                        >
                          {Array.from({ length: 5 }, (_, index) => (
                            <DynamicHugeIcon
                              key={`${activeReviewSpotlight.id}-spotlight-star-${index}`}
                              name="StarIcon"
                              className={`h-3 w-3 ${
                                index < Math.floor(Math.max(0, activeReviewSpotlight.rating))
                                  ? "text-primary"
                                  : "text-primary/25"
                              }`}
                              fill="currentColor"
                              aria-hidden={true}
                            />
                          ))}
                        </div>
                        <span className="text-[0.78rem] font-semibold text-primary sm:text-[0.82rem]">
                          {Math.max(0, activeReviewSpotlight.rating).toFixed(1)}
                        </span>
                      </div>
                      <span className="shrink-0 text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-primary/40 sm:text-[0.6rem]">
                        {activeReviewSpotlight.author}
                      </span>
                    </div>

                    <p className="mt-0.5 line-clamp-1 text-[0.72rem] leading-snug text-primary/75 sm:line-clamp-2 sm:text-[0.78rem] sm:leading-snug">
                      {activeReviewSpotlight.comment}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          <section className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] md:items-start md:gap-7 lg:gap-10">
            {/* Left: Gallery Stack */}
            <div className="relative">

              {/* Desktop Main Image & Thumbnails */}
              <div className="hidden md:flex max-w-[31rem] flex-col gap-3">
                <div
                  className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-primary/10 bg-secondary cursor-zoom-in"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setZoomPos({
                      x: ((e.clientX - rect.left) / rect.width) * 100,
                      y: ((e.clientY - rect.top) / rect.height) * 100,
                    });
                  }}
                  onMouseEnter={() => setIsZooming(true)}
                  onMouseLeave={() => setIsZooming(false)}
                  onClick={() => {
                    const nextIndex = galleryImages.indexOf(activeImage);
                    setLightboxIndex(nextIndex >= 0 ? nextIndex : 0);
                    setLightboxOpen(true);
                  }}
                >
                  <CloudinaryImage
                    key={activeImage}
                    src={activeImage}
                    alt={`${product.name} main view`}
                    fill
                    sizes="(max-width: 1024px) 42vw, 34vw"
                    className="object-cover w-full h-full"
                    priority
                    style={{
                      transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                      transform:
                        isZooming && supportsHover ? "scale(1.45)" : "scale(1)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                  {supportsHover && (
                    <div className="absolute bottom-3 right-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-white backdrop-blur-sm pointer-events-none">
                      Hover to zoom · Click to enlarge
                    </div>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {galleryImages.map((src, index) => (
                    <button
                      key={src}
                      type="button"
                      title={`View image ${index + 1}`}
                      onClick={() => {
                        setActiveImage(src);
                        setLightboxIndex(index);
                        setLightboxOpen(true);
                      }}
                      className={`relative aspect-square w-18 shrink-0 overflow-hidden rounded-2xl border transition-all ${
                        activeImage === src
                          ? "border-primary opacity-100"
                          : "border-primary/10 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <CloudinaryImage
                        src={src}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Snap Carousel - Full Width */}
              <div className="relative -mx-4 sm:-mx-6 md:hidden">
                <div className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" ref={mobileCarouselRef}>
                  {galleryImages.map((src, index) => (
                    <div
                      key={src}
                      className="relative min-h-[82vw] w-full shrink-0 snap-start overflow-hidden border-y border-primary/10 bg-secondary cursor-pointer"
                      onClick={() => {
                        setActiveImage(src);
                        setLightboxIndex(index);
                        setLightboxOpen(true);
                      }}
                    >
                      <CloudinaryImage
                        src={src}
                        alt={`${product.name} image ${index + 1}`}
                        fill
                        sizes="100vw"
                        className="object-cover object-center"
                        priority={index === 0}
                      />
                    </div>
                  ))}
                </div>

                {/* Floating Action Button - Back */}
                <div className="pointer-events-none absolute left-3 top-3 z-20 flex">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary/35 bg-black/45 text-secondary shadow-[0_10px_20px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:bg-black/55"
                  >
                    <DynamicHugeIcon
                      name="ArrowLeft01Icon"
                      className="h-4.5 w-4.5"
                      aria-hidden={true}
                    />
                  </button>
                </div>

                {/* Floating Action Buttons - Share & Wishlist */}
                <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => toggleWishlistItem(product.id)}
                    aria-label={`${isWishlisted ? "Remove from" : "Add to"} wishlist`}
                    className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary/35 bg-black/45 text-secondary shadow-[0_10px_20px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:bg-black/55"
                  >
                    <DynamicHugeIcon
                      name="FavouriteIcon"
                      className={`h-4.5 w-4.5 transition-colors ${isWishlisted ? "fill-secondary" : "fill-none"}`}
                      aria-hidden={true}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    aria-label="Share product"
                    className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary/35 bg-black/45 text-secondary shadow-[0_10px_20px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:bg-black/55"
                  >
                    <DynamicHugeIcon
                      name="Share01Icon"
                      className="h-4.5 w-4.5"
                      aria-hidden={true}
                    />
                  </button>
                </div>

                {/* Subtle Image Indicator Dots */}
                {galleryImages.length > 1 && (
                  <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                    {galleryImages.map((_, index) => (
                      <div
                        key={index}
                        className={`transition-all ${
                          mobileCarouselIndex === index
                            ? "h-1.5 w-6 rounded-full bg-secondary/80"
                            : "h-1 w-1 rounded-full bg-secondary/40"
                        }`}
                        aria-hidden={true}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {galleryImages.map((src, index) => (
                    <button
                      key={`${src}-mobile-thumb`}
                      type="button"
                      aria-label={`Open image ${index + 1}`}
                      onClick={() => {
                        setActiveImage(src);
                        setMobileCarouselIndex(index);
                        const carousel = mobileCarouselRef.current;
                        if (carousel) {
                          const width = carousel.clientWidth;
                          carousel.scrollTo({
                            left: index * width,
                            behavior: "smooth",
                          });
                        }
                      }}
                      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${
                        activeImage === src
                          ? "border-primary ring-1 ring-primary/35"
                          : "border-primary/20"
                      }`}
                    >
                      <CloudinaryImage
                        src={src}
                        alt={`${product.name} thumbnail ${index + 1}`}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Sticky Details */}
            <div className="relative">
              <div className="flex flex-col items-start md:sticky md:top-26">
                <div className="w-full">
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="font-display text-[1.45rem] leading-[1.05] tracking-tight max-[359px]:text-[1.35rem] sm:text-[1.85rem] md:text-[2.45rem] md:leading-[1.06] lg:text-[2.85rem]">
                      {product.name}
                    </h1>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="group mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-95 md:flex"
                      aria-label="Share product"
                    >
                      <DynamicHugeIcon
                        name="Share01Icon"
                        className="h-4 w-4 opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                    </button>
                  </div>

                  {/* Embedded Review Snapshot */}
                  {reviewCount > 0 || averageRating > 0 ? (
                    <a
                      href="#reviews"
                      className="group mt-2.5 flex items-center gap-2 transition-opacity"
                    >
                      <div className="flex text-primary">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const isFilled = i < Math.floor(averageRating);
                          const isHalf =
                            i === Math.floor(averageRating) &&
                            averageRating % 1 > 0;
                          return (
                            <DynamicHugeIcon
                              key={i}
                              name={isHalf ? "StarHalfIcon" : "StarIcon"}
                              fill={isFilled ? "currentColor" : "none"}
                              className="h-3.5 w-3.5"
                            />
                          );
                        })}
                      </div>
                      <span className="text-xs font-medium text-primary/70 group-hover:text-primary transition-colors underline decoration-primary/20 underline-offset-4">
                        {averageRating.toFixed(1)} ({reviewCount} reviews)
                      </span>
                    </a>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-end gap-2 sm:gap-3">
                    <span className="text-[1.7rem] font-medium tracking-tight text-primary max-[359px]:text-[1.52rem] sm:text-[1.9rem] md:text-2xl">
                      {formatPrice(sellingPrice)}
                    </span>
                    {isDiscounted && (
                      <span className="mb-0.5 text-sm text-primary/40 line-through decoration-1 sm:text-base">
                        {formatPrice(product.originalPrice)}
                      </span>
                    )}
                    {discountPercent > 0 && (
                      <span className="mb-1 rounded-full bg-primary/5 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-widest text-[#a83232] sm:text-[0.6rem]">
                        {discountPercent}% Off
                      </span>
                    )}
                  </div>

                  <div className="mt-3 h-px w-full bg-primary/10" />

                  <p className="mt-3 text-[0.84rem] leading-relaxed text-primary/80 sm:text-sm">
                    {product.description}
                  </p>
                </div>

                {/* Selection Options (Colors & Sizes) */}
                {(product.colorOptions.length > 0 ||
                  product.sizeOptions.length > 0) && (
                  <div className="mt-5 flex w-full flex-col gap-4.5">
                    {product.colorOptions.length > 0 && (
                      <div>
                        <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-primary/80 mb-2.5">
                          Color
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {product.colorOptions.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                setActiveColor(color);
                                setCartActionError("");
                              }}
                              aria-label={`Select color ${color}`}
                              className={`flex h-9 min-w-[3.4rem] items-center justify-center rounded-full border px-3.5 text-[0.72rem] font-semibold uppercase tracking-wide transition-colors sm:h-10 sm:min-w-[3.6rem] sm:px-4 sm:text-xs ${
                                activeColor === color
                                  ? "border-primary bg-primary text-secondary"
                                  : "border-primary/20 bg-transparent text-primary hover:border-primary/50"
                              }`}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {product.sizeOptions.length > 0 && (
                      <div className="relative">
                        <div className="mb-2.5 flex items-center justify-between">
                          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-primary/80">
                            Size
                          </h3>
                          <div
                            className="relative"
                            onMouseEnter={() => {
                              if (supportsHover) {
                                setIsSizeGuideOpen(true);
                              }
                            }}
                            onMouseLeave={() => {
                              if (supportsHover) {
                                setIsSizeGuideOpen(false);
                              }
                            }}
                          >
                            <button
                              type="button"
                              aria-label="Open size guide"
                              aria-expanded={isSizeGuideOpen}
                              onClick={() =>
                                setIsSizeGuideOpen((previous) => !previous)
                              }
                              className="text-[0.62rem] uppercase tracking-widest text-primary/50 underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary sm:text-[0.65rem]"
                            >
                              Size Guide
                            </button>
                            <AnimatePresence>
                              {isSizeGuideOpen ? (
                                <motion.div
                                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                                  transition={{
                                    duration: 0.2,
                                    ease: [0.22, 1, 0.36, 1],
                                  }}
                                  className="absolute right-0 top-7 z-20 w-[14.5rem] rounded-2xl border border-primary/15 bg-secondary/95 p-3 shadow-[0_20px_40px_rgba(54,19,19,0.16)] backdrop-blur-sm"
                                >
                                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary/55">
                                    Size Chart (Bust)
                                  </p>
                                  <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[0.72rem] text-primary/80">
                                    <span className="font-semibold">S</span>
                                    <span>34 in</span>
                                    <span className="font-semibold">M</span>
                                    <span>36 in</span>
                                    <span className="font-semibold">L</span>
                                    <span>38 in</span>
                                    <span className="font-semibold">XL</span>
                                    <span>40 in</span>
                                    <span className="font-semibold">XXL</span>
                                    <span>42 in</span>
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {product.sizeOptions.map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => {
                                setActiveSize(size);
                                setCartActionError("");
                              }}
                              aria-label={`Select size ${size}`}
                              className={`flex h-9 min-w-[3rem] items-center justify-center rounded-full border px-3 text-[0.72rem] font-semibold uppercase tracking-wide transition-colors sm:h-10 sm:text-xs ${
                                activeSize === size
                                  ? "border-primary bg-primary text-secondary"
                                  : "border-primary/20 bg-transparent text-primary hover:border-primary/50"
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5 w-full">
                  <p className="mb-4 text-[0.65rem] font-semibold uppercase tracking-widest text-primary/60 flex items-center gap-2">
                    <span
                      className={`block h-1.5 w-1.5 rounded-full ${product.stockQty > 0 ? "bg-green-600/80" : "bg-red-600/80"}`}
                    />
                    {product.stockQty > 0 ? "In Stock" : "Out of Stock"}
                  </p>

                  {/* Actions */}
                  <div className="relative z-10 mt-4 flex w-full flex-row gap-2.5 md:mt-0">
                    <button
                      type="button"
                      onClick={() => {
                        void handleAddToCart();
                      }}
                      aria-label="Add to cart"
                      className="flex h-11 flex-1 items-center justify-center rounded-full border border-primary bg-primary px-4 py-2 text-[0.64rem] font-bold uppercase tracking-[0.16em] text-secondary transition-colors hover:bg-primary/90 sm:h-12 sm:px-8 sm:text-[0.7rem] sm:tracking-[0.2em]"
                    >
                      Add to Cart
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWishlistItem(product.id)}
                      aria-label={`${isWishlisted ? "Remove from" : "Add to"} wishlist`}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-primary/20 bg-transparent px-4 py-2 text-[0.64rem] font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:border-primary/40 hover:bg-primary/5 sm:h-12 sm:px-8 sm:text-[0.7rem] sm:tracking-[0.2em]"
                    >
                      <DynamicHugeIcon
                        name="FavouriteIcon"
                        className={`h-4 w-4 transition-colors ${isWishlisted ? "fill-primary" : "fill-none"}`}
                      />
                      {isWishlisted ? "Saved" : "Add to Wishlist"}
                    </button>
                  </div>

                  {cartActionError ? (
                    <p className="mt-2 text-xs font-medium text-[#a83232]">
                      {cartActionError}
                    </p>
                  ) : null}

                  {/* Value Props */}
                  <div className="mt-4.5 flex flex-col gap-2 text-[0.6rem] font-semibold uppercase tracking-wider text-primary/70 sm:text-[0.65rem]">
                    <div className="flex items-center gap-2.5">
                      <DynamicHugeIcon
                        name="ShoppingBag01Icon"
                        className="h-4 w-4 opacity-70"
                      />
                      <span>Free shipping on orders over ₹999</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <DynamicHugeIcon
                        name="AiChat01Icon"
                        className="h-4 w-4 opacity-70"
                      />
                      <span>24/7 Premium Support Available</span>
                    </div>

                    <AnimatePresence mode="wait">
                      {urgencyVisible && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2.5 text-[#a83232]"
                        >
                          <DynamicHugeIcon
                            name="UserIcon"
                            className="h-4 w-4 opacity-70"
                          />
                          <motion.span
                            key={liveViewers}
                            initial={{ opacity: 0.5, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="font-bold"
                          >
                            {liveViewers} people checking out this
                          </motion.span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </section>



          {/* Full Details & Reviews Section */}
          <section
            id="reviews"
            className="mt-8 border-t border-primary/10 pt-6 md:mt-14 md:pt-10"
          >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.35fr] lg:gap-10">
              <div>
                <h2 className="font-display text-[1.6rem] sm:text-[2.1rem] sm:text-4xl">
                  Customer Reviews
                </h2>
                <div className="mt-2 sm:mt-4">
                  <div className="flex items-end gap-3">
                    <span className="text-2xl sm:text-[2.7rem] font-display sm:text-5xl">
                      {averageRating > 0 ? averageRating.toFixed(1) : "0.0"}
                    </span>
                    <span className="mb-1 text-xs font-medium uppercase tracking-widest text-primary/60 sm:text-sm">
                      Out of 5
                    </span>
                  </div>
                  <div className="mt-3 flex gap-0.5 text-primary sm:gap-1">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const isFilled = i < Math.floor(averageRating);
                      const isHalf =
                        i === Math.floor(averageRating) &&
                        averageRating % 1 > 0;
                      return (
                        <DynamicHugeIcon
                          key={i}
                          name={isHalf ? "StarHalfIcon" : "StarIcon"}
                          fill={isFilled ? "currentColor" : "none"}
                          className="h-4 w-4 sm:h-6 sm:w-6"
                        />
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs font-medium text-primary/70 sm:text-sm">
                    Based on {reviewCount}{" "}
                    {reviewCount === 1 ? "review" : "reviews"} recorded in
                    system.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <form
                  onSubmit={handleReviewSubmit}
                  className="rounded-3xl border border-primary/12 bg-secondary/55 p-4 sm:p-5"
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary/60">
                    Write your review
                  </p>
                  <div
                    className="mt-3 flex items-center gap-1.5 text-primary"
                    onMouseLeave={() => setHoveredReviewRating(null)}
                  >
                    {Array.from({ length: 5 }).map((_, index) => {
                      const activeRating = hoveredReviewRating ?? reviewRating;
                      const selected = index + 1 <= activeRating;
                      return (
                        <motion.button
                          key={`review-rating-${index}`}
                          type="button"
                          aria-label={`Rate ${index + 1} star${index === 0 ? "" : "s"}`}
                          onMouseEnter={() => setHoveredReviewRating(index + 1)}
                          onFocus={() => setHoveredReviewRating(index + 1)}
                          onBlur={() => setHoveredReviewRating(null)}
                          onClick={() => setReviewRating(index + 1)}
                          whileHover={{ scale: 1.08, y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          transition={{
                            duration: 0.14,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${selected ? "border-primary bg-primary text-secondary" : "border-primary/20 text-primary/60 hover:border-primary/40"}`}
                        >
                          <DynamicHugeIcon
                            name="StarIcon"
                            className="h-3.5 w-3.5"
                            fill={selected ? "currentColor" : "none"}
                          />
                        </motion.button>
                      );
                    })}
                  </div>
                  <textarea
                    aria-label="Write your review"
                    value={reviewDraft}
                    onChange={(event) => setReviewDraft(event.target.value)}
                    placeholder={
                      isAuthenticated
                        ? "Share your experience with fit, comfort, and craftsmanship..."
                        : "Sign in to write your review..."
                    }
                    disabled={
                      !isAuthenticated || isLoading || isSubmittingReview
                    }
                    className="mt-3 min-h-[6.2rem] w-full resize-y rounded-2xl border border-primary/15 bg-paper px-3.5 py-3 text-sm leading-relaxed text-primary placeholder:text-primary/45 focus:border-primary/35 focus:outline-none disabled:cursor-not-allowed disabled:opacity-65"
                  />
                  {/* Image upload section */}
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {reviewImagePreviews.map((src, idx) => (
                        <div
                          key={idx}
                          className="relative h-16 w-16 overflow-hidden rounded-xl border border-primary/15"
                        >
                          <img
                            src={src}
                            alt={`Review image ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            aria-label={`Remove image ${idx + 1}`}
                            onClick={() => removeReviewImage(idx)}
                            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[0.6rem] text-white"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {reviewImages.length < 3 && isAuthenticated && (
                        <label
                          className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/25 bg-primary/[0.03] text-primary/55 transition hover:border-primary/40 hover:bg-primary/[0.06]"
                          aria-label="Upload review image"
                        >
                          <span className="text-xl leading-none">+</span>
                          <span className="mt-0.5 text-[0.56rem] font-semibold uppercase tracking-wide">
                            Photo
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={handleReviewImageSelect}
                            disabled={isSubmittingReview}
                          />
                        </label>
                      )}
                    </div>
                    {reviewImages.length > 0 && (
                      <p className="mt-1.5 text-[0.6rem] font-medium text-primary/55">
                        {reviewImages.length}/3 image
                        {reviewImages.length !== 1 ? "s" : ""} selected ·
                        (upload is visual only for now)
                      </p>
                    )}
                  </div>
                  {reviewError ? (
                    <p className="mt-2 text-xs text-[#a83232]">{reviewError}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    {isAuthenticated ? (
                      <button
                        type="submit"
                        aria-label="Submit review"
                        disabled={
                          isSubmittingReview ||
                          reviewDraft.trim().length === 0 ||
                          reviewRating === 0
                        }
                        className="inline-flex h-10 items-center justify-center rounded-full border border-primary bg-primary px-5 text-[0.65rem] font-bold uppercase tracking-[0.17em] text-secondary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {isSubmittingReview ? "Submitting..." : "Submit Review"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label="Sign in to review"
                        onClick={() => setIsAuthModalOpen(true)}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-primary bg-primary px-5 text-[0.65rem] font-bold uppercase tracking-[0.17em] text-secondary transition-colors hover:bg-primary/90"
                      >
                        Sign In to Review
                      </button>
                    )}
                    <span className="text-xs text-primary/58">
                      Verified and approved reviews are posted instantly.
                    </span>
                  </div>
                </form>

                {isReviewsLoading ? (
                  <div className="rounded-2xl border border-primary/12 bg-primary/[0.03] px-4 py-5 text-sm text-primary/65">
                    Loading reviews...
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/[0.03] px-4 py-6 text-sm text-primary/65">
                    No reviews yet for this piece.
                  </div>
                ) : (
                  <div className="flex flex-col gap-5 rounded-2xl border border-primary/10 bg-primary/[0.02] p-4 sm:p-5">
                    {reviews.map((review, index) => (
                      <article
                        key={review.id}
                        className={`pb-5 ${index !== reviews.length - 1 ? "border-b border-primary/10" : "pb-0"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-primary">
                            {review.userName}
                          </p>
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary/45">
                            {formatReviewDate(review.createdAt)}
                          </p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-primary">
                          {Array.from({ length: 5 }).map((_, starIndex) => (
                            <DynamicHugeIcon
                              key={`${review.id}-star-${starIndex}`}
                              name="StarIcon"
                              className="h-4 w-4"
                              fill={
                                starIndex < review.rating
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          ))}
                          {review.isVerifiedPurchase ? (
                            <span className="ml-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary/55">
                              Verified Purchaser
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2.5 text-sm leading-relaxed text-primary/82">
                          {review.comment}
                        </p>
                        {review.imageUrls.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {review.imageUrls.map((src) => (
                              <a
                                key={src}
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                                className="block h-16 w-16 overflow-hidden rounded-lg border border-primary/14"
                              >
                                <CloudinaryImage
                                  src={src}
                                  alt={`${review.userName} review photo`}
                                  width={120}
                                  height={120}
                                  className="h-full w-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Recommended Products */}
          {relatedProducts && relatedProducts.length > 0 && (
            <section className="mt-8 border-t border-primary/10 pb-6 pt-8 md:mt-12 md:pt-10">
              <div className="mb-6">
                <h2 className="font-display text-[1.6rem] sm:text-[2.1rem]">
                  Recommended for you
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6 md:grid-cols-4 md:gap-y-8">
                {relatedProducts.map((related) => {
                  const relatedImage =
                    related.mainImageUrl ||
                    related.otherImageUrls[0] ||
                    "/logo4.png";
                  return (
                    <Link
                      key={related.id}
                      href={`/products/${related.category}/${related.subCategory}/${related.slug}`}
                      aria-label={`Open ${related.name}`}
                      className="group flex flex-col gap-3"
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-secondary">
                        <CloudinaryImage
                          src={relatedImage}
                          alt={related.name}
                          fill
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      </div>
                      <div>
                        <p className="line-clamp-2 text-sm font-medium leading-tight text-primary group-hover:underline underline-offset-2">
                          {related.name}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.15em] text-primary/50">
                          {related.subCategoryValue}
                        </p>
                        <p className="mt-2 text-sm font-semibold tracking-tight text-primary">
                          {formatPrice(getProductPrice(related))}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Floating Action Bar Overlay for Reviews Section on Mobile */}
      <AnimatePresence>
        {isReviewsSectionVisible && !isAddedToCart && !isWishlisted && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[150] bg-paper px-4 py-5 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] sm:hidden"
          >
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void handleAddToCart();
                }}
                className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary px-2 text-[0.65rem] font-bold uppercase tracking-widest text-secondary active:scale-95 transition-transform"
              >
                Add to Cart
              </button>
              <button
                type="button"
                onClick={() => toggleWishlistItem(product.id)}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-transparent px-2 text-[0.65rem] font-bold uppercase tracking-widest text-primary active:scale-95 transition-transform"
              >
                <DynamicHugeIcon
                  name="FavouriteIcon"
                  className="h-3.5 w-3.5 fill-none"
                />
                Wishlist
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        open={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Sign in to post a review"
        description="Only logged-in users can post reviews for products."
      />

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-white p-4"
            onClick={() => {
              setLightboxOpen(false);
              setPinchScale(1);
            }}
          >
            {/* Close */}
            <button
              type="button"
              aria-label="Close fullscreen image"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(false);
                setPinchScale(1);
              }}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-white text-primary transition hover:bg-primary/5"
            >
              <DynamicHugeIcon name="Cancel01Icon" className="h-5 w-5" />
            </button>
            {/* Prev */}
            {galleryImages.length > 1 && (
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(
                    (i) =>
                      (i - 1 + galleryImages.length) % galleryImages.length,
                  );
                  setPinchScale(1);
                }}
                className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-white text-primary transition hover:bg-primary/5 sm:left-6"
              >
                <DynamicHugeIcon name="ArrowLeft01Icon" className="h-6 w-6" />
              </button>
            )}
            {/* Next */}
            {galleryImages.length > 1 && (
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i + 1) % galleryImages.length);
                  setPinchScale(1);
                }}
                className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-white text-primary transition hover:bg-primary/5 sm:right-6"
              >
                <DynamicHugeIcon name="ArrowRight01Icon" className="h-6 w-6" />
              </button>
            )}
            {/* Main image with pinch-zoom & pan */}
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
              <motion.div
                key={lightboxIndex}
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="relative flex items-center justify-center select-none"
                onClick={(e) => {
                  e.stopPropagation();
                  const now = Date.now();
                  if (now - lastTapRef.current < 300) {
                    // Double tap logic
                    if (pinchScale > 1) {
                      setPinchScale(1);
                    } else {
                      setPinchScale(2.5);
                    }
                    lastTapRef.current = 0;
                  } else {
                    lastTapRef.current = now;
                  }
                }}
                onTouchStart={() => {}}
                onTouchMove={() => {}}
                onTouchEnd={(e) => {
                  if (pinchScale === 1 && swipeStartRef.current !== null) {
                    const deltaX = e.changedTouches[0].clientX - swipeStartRef.current;
                    if (Math.abs(deltaX) > 60) {
                      if (deltaX > 0) {
                        // Swipe Right -> Prev
                        setLightboxIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length);
                      } else {
                        // Swipe Left -> Next
                        setLightboxIndex((i) => (i + 1) % galleryImages.length);
                      }
                    }
                  }
                  swipeStartRef.current = null;
                }}
                style={{
                  scale: 1,
                  x: 0,
                  y: 0,
                  transformOrigin: "center center",
                }}
              >
                <img
                  src={
                    galleryImages[lightboxIndex] ??
                    galleryImages[0] ??
                    "/logo4.png"
                  }
                  alt={`${product.name} image ${lightboxIndex + 1}`}
                  className="max-h-[85vh] max-w-[95vw] rounded-xl object-contain shadow-[0_0_80px_rgba(0,0,0,0.6)]"
                  draggable={false}
                />
              </motion.div>
            </div>
            {/* Dots indicator */}
            {galleryImages.length > 1 && (
              <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5">
                {galleryImages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to image ${i + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(i);
                      setPinchScale(1);
                    }}
                    className={`h-1.5 rounded-full transition-all ${i === lightboxIndex ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
