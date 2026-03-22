"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { CloudinaryImage } from "@/app/components/cloudinary-image";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { Skiper54, type SkiperImage } from "@/app/components/skiper54";
import { CLOUDINARY_SIZES } from "@/lib/cloudinary";

type SubCategory = {
  name: string;
  slug: string;
  image: string;
  alt: string;
};

type CategorySection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  slug: string;
  sectionTone: "cream" | "maroon";
  subCategories: SubCategory[];
};

type MobileBestSellerProduct = {
  name: string;
  description: string;
  price: string;
  image: string;
  alt: string;
};

type AnnouncementItem = {
  id: string;
  text: string;
};

const heroImage = "https://res.cloudinary.com/dueruzfoq/image/upload/v1774145271/heroimage_eirhec.png";
const storyImage = "https://res.cloudinary.com/dueruzfoq/image/upload/v1774145316/1_x6veq2.png";

const mostLovedSlides: SkiperImage[] = [
  {
    title: "Signature Bridal Lehenga",
    alt: "Indian woman in a red and navy embroidered bridal lehenga",
    src: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146155/3_ktinir.png",
  },
  {
    title: "Signature Festive Kurta",
    alt: "Indian woman in maroon and cream festive kurta set",
    src: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146139/2_qhkrc8.png",
  },
  {
    title: "Occasion Saree Edit",
    alt: "Woman in premium saree styling for festive event",
    src: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146179/4_vfmdf4.png",
  },
  {
    title: "Wedding Guest Edit",
    alt: "Indian woman in elegant maroon occasion wear",
    src: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146198/5_et1rmm.png",
  },
  {
    title: "Signature Veil Lehenga",
    alt: "Indian woman in a purple embroidered lehenga with a sheer embellished veil",
    src: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146155/3_ktinir.png",
  },
  {
    title: "Everyday Premium Line",
    alt: "Indian woman in premium daily wear ethnic set",
    src: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146223/6_euy4pm.png",
  },
  
  {
    title: "Statement Embroidery",
    alt: "Indian woman in embroidered maroon kurta and palazzo",
    src: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146198/5_et1rmm.png",
  },
  {
    title: "Contemporary Fusion",
    alt: "Woman in indo-western contemporary silhouette",
    src: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146266/pomelli-image-1_3_rf3glc.png",
  },
];

const mobileBestSellerProducts: MobileBestSellerProduct[] = [
  {
    name: "Signature Bridal Lehenga",
    description: "Hand-embroidered bridal edit with heirloom detailing.",
    price: "Rs. 2,499",
    image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774153423/pomelli-image-2_oq8pji.png",
    alt: "Indian woman in a red and navy embroidered bridal lehenga",
  },
  {
    name: "Occasion Saree Edit",
    description: "Festive drape in premium silk-inspired texture.",
    price: "Rs. 1,999",
    image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774153450/pomelli-image-3_fik7m0.png",
    alt: "Woman in premium saree styling for festive event",
  },
  {
    name: "Statement Embroidery",
    description: "Contemporary maroon set with elevated craftsmanship.",
    price: "Rs. 1,799",
    image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774153460/pomelli-image-3_poe51d.png",
    alt: "Indian woman in embroidered maroon kurta and palazzo",
  },
  {
    name: "Contemporary Fusion",
    description: "Indo-western silhouette for modern celebrations.",
    price: "Rs. 2,199",
    image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146266/pomelli-image-1_3_rf3glc.png",
    alt: "Woman in indo-western contemporary silhouette",
  },
];

const topAnnouncements: AnnouncementItem[] = [
  { id: "offer-1", text: "Flat 20% OFF on Festive Styles | Code: NAARI20" },
  { id: "offer-2", text: "Free Shipping on orders above Rs. 1,499" },
  { id: "offer-3", text: "New Arrival Drop every Friday at 7 PM" },
];

const categories: CategorySection[] = [
  {
    id: "ethnic",
    eyebrow: "The Heritage Hub",
    title: "Ethnic Wear",
    body: "Pure elegance in every fold. Shop Sarees, Lehengas, and Anarkalis.",
    slug: "ethnic-wear",
    sectionTone: "cream",
    subCategories: [
      {
        name: "Saree",
        slug: "saree",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146299/2_uecv6t.png",
        alt: "Model wearing an embroidered maroon saree",
      },
      {
        name: "Lehenga",
        slug: "lehenga",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146319/1_byc5lz.png",
        alt: "Woman in lehenga-inspired festive silhouette",
      },
      {
        name: "Anarkali",
        slug: "anarkali",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146333/1_pl4iyu.png",
        alt: "Woman in flowy anarkali-style festive wear",
      },
    ],
  },
  {
    id: "western",
    eyebrow: "Modern Muse",
    title: "Western Wear",
    body: "Effortless style for the everyday woman. Explore Dresses, Tops, and Skirts.",
    slug: "western-wear",
    sectionTone: "maroon",
    subCategories: [
      {
        name: "Dresses",
        slug: "dresses",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146385/1_ccdhb3.png",
        alt: "Woman in contemporary maroon dress-inspired look",
      },
      {
        name: "Tops",
        slug: "tops",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146393/1_upqovg.png",
        alt: "Woman styling a premium embroidered top",
      },
      {
        name: "Skirts",
        slug: "skirts",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146400/1_vi5avd.png",
        alt: "Woman in skirt-led modern fusion styling",
      },
    ],
  },
  {
    id: "bottoms",
    eyebrow: "The Comfort Core",
    title: "Bottom Wear",
    body: "Versatility from the waist down. Trousers, Palazzos, and Denims.",
    slug: "bottom-wear",
    sectionTone: "cream",
    subCategories: [
      {
        name: "Jeans",
        slug: "jeans",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146443/1_agnfvy.png",
        alt: "Woman styled in clean premium bottom-focused silhouette",
      },
      {
        name: "Trousers",
        slug: "trousers-pants",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146454/1_knncmz.png",
        alt: "Model wearing tailored cream trousers",
      },
      {
        name: "Palazzo",
        slug: "palazzo",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146467/1_j6sc3d.png",
        alt: "Woman in wide-leg palazzo styling",
      },
    ],
  },
  {
    id: "fusion",
    eyebrow: "The Best of Both Worlds",
    title: "Fusion Wear",
    body: "Where East meets West. Discover crop tops, Indo-Western sets, and more.",
    slug: "fusion-wear",
    sectionTone: "maroon",
    subCategories: [
      {
        name: "Indo-Western Dresses",
        slug: "indo-western-dresses",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146500/1_ye6smw.png",
        alt: "Woman in premium indo-western dress styling",
      },
      {
        name: "Crop Top + Skirt",
        slug: "crop-top-skirt",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146509/1_vj7ms1.png",
        alt: "Woman in crop top and skirt-inspired fusion set",
      },
      {
        name: "Kurti + Jeans",
        slug: "kurti-jeans",
        image: "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146521/1_hpruxs.png",
        alt: "Woman styling kurti with contemporary bottom wear",
      },
    ],
  },
];

const revealContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const revealItem = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function categoryHref(category: string, subcategory?: string) {
  const params = new URLSearchParams({ category });
  if (subcategory) {
    params.set("subcategory", subcategory);
  }
  return `/products?${params.toString()}`;
}

export function LandingPage() {
  const prefersReducedMotion = useReducedMotion();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [activeAnnouncementIndex, setActiveAnnouncementIndex] = useState(0);
  const [mobileCarouselInteracted, setMobileCarouselInteracted] = useState(false);
  const mobileCarouselRef = useRef<HTMLDivElement | null>(null);
  const mobileTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 520);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveAnnouncementIndex((previousIndex) =>
        previousIndex === topAnnouncements.length - 1 ? 0 : previousIndex + 1,
      );
    }, 4500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleMobileCarouselTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    mobileTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleMobileCarouselTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (mobileCarouselInteracted || event.touches.length !== 1) {
      return;
    }

    const startPoint = mobileTouchStartRef.current;
    if (!startPoint) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - startPoint.x);
    const deltaY = Math.abs(touch.clientY - startPoint.y);

    // Stop autoplay only when swipe intent is clearly horizontal.
    if (deltaX > 16 && deltaX > deltaY * 1.1) {
      setMobileCarouselInteracted(true);
    }
  };

  const handleMobileCarouselTouchEnd = () => {
    mobileTouchStartRef.current = null;
  };

  useEffect(() => {
    if (prefersReducedMotion || mobileCarouselInteracted) {
      return;
    }

    const track = mobileCarouselRef.current;
    if (!track) {
      return;
    }

    let animationFrameId = 0;
    let lastTimestamp = performance.now();
    const pxPerMs = 0.045;

    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      track.scrollLeft += elapsed * pxPerMs;

      const loopWidth = track.scrollWidth / 2;
      if (track.scrollLeft >= loopWidth) {
        track.scrollLeft -= loopWidth;
      }

      animationFrameId = window.requestAnimationFrame(animate);
    };

    animationFrameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [mobileCarouselInteracted, prefersReducedMotion]);

  return (
    <main className="w-full pt-14 md:pt-0">
      <section className="w-full border-b border-secondary/25 bg-gradient-to-r from-primary via-primary/95 to-primary text-secondary md:hidden">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-3 sm:px-5 md:px-8 lg:px-12">
          <div
            aria-live="polite"
            aria-atomic={true}
            className="relative w-full overflow-hidden text-center pt-1 sm:pt-0"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={topAnnouncements[activeAnnouncementIndex]?.id}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-secondary sm:text-[0.72rem] sm:tracking-[0.22em]"
              >
                {topAnnouncements[activeAnnouncementIndex]?.text}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </section>

      <section id="hero" className="section-shell bg-secondary md:min-h-[calc(100vh-4.5rem)]">
        <div
          aria-live="polite"
          aria-atomic={true}
          className="pointer-events-none absolute inset-x-0 top-[4.5rem] z-10 hidden border-b border-secondary/25 bg-primary text-secondary md:block"
        >
          <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-2 md:px-8 lg:px-12">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`desktop-${topAnnouncements[activeAnnouncementIndex]?.id}`}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-secondary"
              >
                {topAnnouncements[activeAnnouncementIndex]?.text}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-2 px-4 py-10 sm:px-5 md:px-8 md:py-14 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-12">
           
          <motion.div
            variants={revealContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="space-y-4 sm:space-y-7"
          >
            <motion.h1
              variants={revealItem}
              className="font-display max-w-xl text-[2.15rem] font-semibold leading-[0.94] text-primary sm:text-[3.5rem] lg:text-[4rem]"
            >
              Wear Your Story.
            </motion.h1>
            <motion.p
              variants={revealItem}
              className="max-w-xl text-[0.96rem] leading-relaxed text-primary/85 sm:text-lg md:text-xl"
            >
              From the heritage of the Saree to the edge of Western wear, discover
              fashion that speaks your language.
            </motion.p>
            <motion.div variants={revealItem} className="hidden sm:block">
              <Link
                href="/products"
                aria-label="Shop the NaariThread collection"
                className="cta-thread-hero w-auto justify-center sm:w-auto mx-auto"
              >
                <span>Shop the Collection</span>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96, y: 24 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative isolate mx-auto h-[50vh] min-h-[340px] w-full max-w-2xl overflow-hidden rounded-t-[6.5rem] rounded-b-[1.7rem] border border-primary/20 bg-primary/5 sm:h-[66vh] sm:min-h-[430px] sm:rounded-t-[6.5rem] sm:rounded-b-[2rem]"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-secondary/50" />
            <CloudinaryImage
              src={heroImage}
              alt="NaariThread hero model in premium maroon and cream outfit"
              fill
              priority
              sizes={CLOUDINARY_SIZES.hero}
              className="image-fade-enter object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/70 to-transparent p-4 text-secondary sm:p-6">
              <p className="text-xs uppercase tracking-[0.24em]">Signature Edit</p>
              <p className="mt-2 text-lg font-semibold sm:text-2xl">Grace in Every Thread</p>
            </div>
          </motion.div>
          <motion.div variants={revealItem} className="sm:hidden flex items-center justify-center w-full mx-auto mt-4">
              <Link
                href="/products"
                aria-label="Shop the NaariThread collection"
                className="cta-thread-hero w-auto justify-center sm:w-auto mx-auto"
              >
                <span>Shop the Collection</span>
              </Link>
            </motion.div>
        </div>
      </section>

      <section className="section-shell bg-primary text-secondary">
        <div className="mx-auto w-full max-w-7xl px-4 py-11 sm:px-5 sm:py-20 md:px-8 lg:px-12">
          <motion.div
            variants={revealContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="mb-8 flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left"
          >
            <motion.div variants={revealItem}>
              <p className="text-[0.68rem] uppercase tracking-[0.28em] text-secondary/80 sm:text-xs sm:tracking-[0.34em]">
                Most Loved
              </p>
              <h2 className="font-display mt-3 text-[2rem] font-semibold leading-[1.04] sm:text-4xl lg:text-5xl">
                Best Sellers
              </h2>
            </motion.div>
            <motion.div variants={revealItem} className="hidden md:block">
              <Link
                href="/products?sort=popular"
                aria-label="Explore all best selling products"
                className="thread-underline text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-secondary sm:text-sm"
              >
                Explore Best Sellers
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="py-1"
          >
            <div className="sm:hidden">
              <div
                ref={mobileCarouselRef}
                aria-label="Swipeable best seller products"
                onTouchStart={handleMobileCarouselTouchStart}
                onTouchMove={handleMobileCarouselTouchMove}
                onTouchEnd={handleMobileCarouselTouchEnd}
                onTouchCancel={handleMobileCarouselTouchEnd}
                className="relative -mx-1 flex touch-manipulation overscroll-y-auto gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {[...mobileBestSellerProducts, ...mobileBestSellerProducts].map((product, index) => (
                  <Link
                    key={`${product.name}-${index}`}
                    href="/products?sort=popular"
                    aria-label={`Shop ${product.name}`}
                    tabIndex={index >= mobileBestSellerProducts.length ? -1 : 0}
                    className="w-[72vw] max-w-[292px] shrink-0 overflow-hidden rounded-2xl border border-secondary/35 bg-secondary/10 select-none"
                  >
                    <div className="relative h-[45vh] aspect-[3/4] w-full overflow-hidden">
                      <CloudinaryImage
                        src={product.image}
                        alt={product.alt}
                        fill
                        loading="lazy"
                        sizes={CLOUDINARY_SIZES.card}
                        className="object-cover object-top"
                      />
                    </div>
                    <div className="border-t border-secondary/25 bg-primary/45 px-4 py-3.5 text-left">
                      <p className="text-[1rem] font-semibold leading-tight text-secondary">{product.name}</p>
                      <p className="mt-1 truncate text-[0.7rem] leading-relaxed text-secondary/80">{product.description}</p>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-full border border-secondary/45 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-secondary">
                          {product.price}
                        </div>
                        <span className="inline-flex items-center text-secondary/90" aria-hidden={true}>
                          <DynamicHugeIcon
                            name="ArrowUpRight01Icon"
                            className="h-3.5 w-3.5"
                            iconStrokeWidth={2}
                            aria-hidden={true}
                          />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-6 flex justify-center">
                <Link
                  href="/products?sort=popular"
                  aria-label="Explore all best selling products"
                  className="inline-flex items-center justify-center rounded-full border border-secondary/55 bg-secondary px-5 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary transition-all duration-300 hover:-translate-y-0.5 hover:bg-transparent hover:text-secondary"
                >
                  Explore Best Sellers
                </Link>
              </div>
            </div>

            <div className="hidden sm:block">
              <Skiper54
                images={mostLovedSlides}
                className="mx-auto"
                autoplay={true}
                loop={true}
                showNavigation={true}
                showPagination={true}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {categories.map((category, index) => {
        const isMaroon = category.sectionTone === "maroon";

        return (
          <section
            key={category.id}
            id={category.id}
            className={`section-shell ${isMaroon ? "bg-primary text-secondary" : "bg-secondary text-primary"}`}
          >
            <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-5 sm:py-16 md:px-8 lg:px-12">
              <motion.div
                variants={revealContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.15 }}
                className="relative mb-8 flex flex-col gap-5 text-center md:flex-row md:items-end md:justify-between md:text-left"
              >
                <motion.div variants={revealItem} className="mx-auto max-w-3xl md:mx-0 md:pr-0">
                  <p
                    className={`text-[0.62rem] uppercase tracking-[0.2em] sm:text-xs sm:tracking-[0.3em] ${
                      isMaroon ? "text-secondary/80" : "text-primary/70"
                    }`}
                  >
                    {category.eyebrow}
                  </p>
                  <h2 className="font-display mt-2.5 text-[1.72rem] font-semibold leading-[1.03] sm:mt-3 sm:text-[2.35rem] md:text-5xl lg:text-6xl">{category.title}</h2>
                  <p className={`mx-auto mt-3 max-w-xl text-[0.95rem] leading-relaxed sm:mt-4 sm:text-lg md:mx-0 md:max-w-none ${isMaroon ? "text-secondary/85" : "text-primary/80"}`}>
                    {category.body}
                  </p>
                </motion.div>
                <motion.div variants={revealItem} className="hidden md:block md:pt-0">
                  <Link
                    href={categoryHref(category.slug)}
                    aria-label={`View all ${category.title} products`}
                    className={`inline-flex items-center justify-center border px-4 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.22em] transition-all duration-300 hover:-translate-y-0.5 sm:text-xs sm:tracking-[0.24em] rounded-full md:px-5 ${
                      isMaroon
                        ? "border-secondary/45 text-secondary hover:bg-secondary hover:text-primary"
                        : "border-primary/35 text-primary hover:bg-primary hover:text-secondary"
                    }`}
                  >
                    View All
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div
                variants={revealContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                className={`grid grid-cols-2 gap-3.5 sm:gap-6 md:grid-cols-2 ${
                  category.subCategories.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"
                }`}
              >
                {category.subCategories.map((sub, subIndex) => (
                  <motion.article
                    key={sub.slug}
                    variants={revealItem}
                    transition={{ duration: 0.65, delay: subIndex * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    className={`group overflow-hidden rounded-2xl border ${
                      isMaroon
                        ? "border-secondary/35 bg-secondary/10"
                        : "border-primary/20 bg-primary/5"
                    }`}
                  >
                    <Link
                      href={categoryHref(category.slug, sub.slug)}
                      aria-label={`Browse ${sub.name} in ${category.title}`}
                      className="block"
                    >
                      <div className="relative h-[40vh] aspect-[3/4] w-full overflow-hidden sm:aspect-auto sm:h-[62vh] sm:min-h-[420px] lg:h-[68vh] lg:min-h-[460px]">
                        <CloudinaryImage
                          src={sub.image}
                          alt={sub.alt}
                          fill
                          loading="lazy"
                          sizes={CLOUDINARY_SIZES.card}
                          className="image-fade-enter object-cover object-top transition duration-700 group-hover:scale-[1.04]"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/55 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <span className="rounded-full border border-secondary/80 bg-primary/30 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                            Shop {sub.name}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`border-t px-3.5 py-3 sm:px-5 sm:py-4 ${
                          isMaroon
                            ? "border-secondary/25 bg-primary/50"
                            : "border-primary/15 bg-secondary/70"
                        }`}
                      >
                        <h3 className="text-[0.9rem] font-semibold leading-tight tracking-wide sm:text-xl">{sub.name}</h3>
                        <p className={`mt-1 text-[0.5rem] uppercase tracking-[0.14em] sm:text-xs sm:tracking-[0.2em] ${isMaroon ? "text-secondary/75" : "text-primary/70"}`}>
                          Curated in the {category.title} edit
                        </p>
                      </div>
                    </Link>
                  </motion.article>
                ))}
              </motion.div>

              <motion.div variants={revealItem} className="mt-6 flex justify-center md:hidden">
                <Link
                  href={categoryHref(category.slug)}
                  aria-label={`View all ${category.title} products`}
                  className={`inline-flex items-center justify-center border px-4 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.22em] transition-all duration-300 hover:-translate-y-0.5 sm:text-xs sm:tracking-[0.24em] rounded-full md:px-5 ${
                    isMaroon
                      ? "border-secondary/45 text-secondary hover:bg-secondary hover:text-primary"
                      : "border-primary/35 text-primary hover:bg-primary hover:text-secondary"
                  }`}
                >
                  View All
                </Link>
              </motion.div>

              {index === categories.length - 1 ? (
                <motion.div
                  variants={revealItem}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                  className="mt-10 sm:block hidden "
                >
                  <Link
                    href="/products"
                    aria-label="Shop all categories on NaariThread"
                    className={`cta-thread ${
                      isMaroon
                        ? "border-secondary bg-secondary text-primary hover:bg-transparent hover:text-secondary"
                        : ""
                    }`}
                  >
                    Shop All Categories
                  </Link>
                </motion.div>
              ) : null}
            </div>
          </section>
        );
      })}

      <section id="story" className="section-shell bg-secondary">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-5 sm:py-16 md:px-8 lg:grid-cols-2 lg:gap-12 lg:px-12">
          <motion.div
            variants={revealContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="space-y-3 sm:space-y-4"
          >
            <motion.p
              variants={revealItem}
              className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-primary/70 sm:text-xs sm:tracking-[0.34em]"
            >
              The Story
            </motion.p>
            <motion.h2 variants={revealItem} className="text-[2.02rem] font-semibold text-primary sm:text-5xl">
              <span className="font-display">The Unbroken Thread</span>
            </motion.h2>
            <motion.p variants={revealItem} className="text-[0.92rem] leading-relaxed text-primary/85 sm:text-lg">
              At NaariThread, we believe a woman&apos;s wardrobe is more than fabric;
              it is a story of where she comes from and where she is going. We
              started with a simple vision: create a space where the timeless grace
              of the Saree meets the effortless cool of the Jumpsuit.
            </motion.p>
            <motion.p variants={revealItem} className="text-[0.92rem] leading-relaxed text-primary/85 sm:text-lg">
              Our name represents the thread that connects generations, from the
              artisan&apos;s hand to the modern woman&apos;s hustle. Whether you are draped
              in six yards of tradition or stepping out in fusion wear,
              NaariThread ensures your style is as resilient and beautiful as the
              thread that binds us all.
            </motion.p>
            <motion.div variants={revealItem} className="pt-2 hidden sm:block">
              <Link href="/products" aria-label="Start shopping NaariThread products" className="cta-thread">
                Start Shopping
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 32, scale: 0.98 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-[56vh] min-h-[320px] overflow-hidden rounded-[1.7rem] border border-primary/20 sm:h-[62vh] sm:min-h-[420px] sm:rounded-[2rem] lg:h-[68vh] lg:min-h-[460px]"
          >
            <CloudinaryImage
              src={storyImage}
              alt="Indian woman symbolizing tradition and modern ambition"
              fill
              loading="lazy"
              sizes={CLOUDINARY_SIZES.story}
              className="image-fade-enter object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
          </motion.div>
          <motion.div variants={revealItem} className="pt-2 w-full items-center mx-auto flex justify-center md:justify-start sm:hidden">
              <Link href="/products" aria-label="Start shopping NaariThread products" className="cta-thread">
                Shop All Products
              </Link>
            </motion.div>
        </div>
      </section>

      <footer className="bg-primary text-secondary">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-9 px-4 py-12 sm:px-5 sm:py-14 md:grid-cols-2 md:px-8 lg:grid-cols-5 lg:px-12">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <Image
                src="/logo4.png"
                alt="NaariThread footer logo"
                width={40}
                height={40}
                className="h-14 w-14 rounded-full border border-secondary/30 object-cover"
              />
              {/* <p className="font-display text-lg tracking-wide">NaariThread</p> */}
              <Image src="/logoname.png" alt="NaariThread logotype" width={128} height={128} className="h-auto w-auto object-contain block mb-2" />
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-secondary/80">
              Premium women clothing from heritage drapes to modern silhouettes, crafted
              for the modern Indian woman.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <a
                href="tel:+918487849852"
                aria-label="Call NaariThread on +91 84878 49852"
                className="inline-flex w-fit items-center gap-2.5 text-sm text-secondary/80 transition hover:text-secondary"
              >
                <DynamicHugeIcon name="CallIcon" className="h-4 w-4 shrink-0" iconStrokeWidth={1.8} />
                +91 84878 49852
              </a>
              <a
                href="mailto:naarithread@gmail.com"
                aria-label="Email NaariThread at naarithread@gmail.com"
                className="inline-flex w-fit items-center gap-2.5 break-all text-sm text-secondary/80 transition hover:text-secondary sm:break-normal"
              >
                <DynamicHugeIcon name="Mail01Icon" className="h-4 w-4 shrink-0" iconStrokeWidth={1.8} />
                naarithread@gmail.com
              </a>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Visit NaariThread on Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-secondary/25 text-secondary/80 transition hover:border-secondary/60 hover:text-secondary"
              >
                <DynamicHugeIcon name="Facebook01Icon" className="h-4.5 w-4.5" iconStrokeWidth={1.8} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Visit NaariThread on Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-secondary/25 text-secondary/80 transition hover:border-secondary/60 hover:text-secondary"
              >
                <DynamicHugeIcon name="InstagramIcon" className="h-4.5 w-4.5" iconStrokeWidth={1.8} />
              </a>
              <a
                href="https://wa.me/918487849852"
                target="_blank"
                rel="noreferrer"
                aria-label="Chat with NaariThread on WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-secondary/25 text-secondary/80 transition hover:border-secondary/60 hover:text-secondary"
              >
                <DynamicHugeIcon name="WhatsappIcon" className="h-4.5 w-4.5" iconStrokeWidth={1.8} />
              </a>
            </div>
          </div>
          
          
          <FooterLinks
            title="Shop"
            links={[
              { label: "All Products", href: "/products" },
              { label: "Best Sellers", href: "/products?sort=popular" },
              { label: "New Arrivals", href: "/products?sort=new" },
              { label: "Offers", href: "/products?tag=offers" },
            ]}
          />
          <FooterLinks
            title="Categories"
            links={[
              { label: "Ethnic Wear", href: categoryHref("ethnic-wear") },
              { label: "Western Wear", href: categoryHref("western-wear") },
              { label: "Bottom Wear", href: categoryHref("bottom-wear") },
              { label: "Fusion Wear", href: categoryHref("fusion-wear") },
            ]}
          />
          <FooterLinks
            title="Policies"
            links={[
              { label: "Shipping Policy", href: "/policies/shipping" },
              { label: "Return & Refund", href: "/policies/returns" },
              { label: "Terms & Conditions", href: "/policies/terms-and-conditions" },
              { label: "Cancellation Policy", href: "/policies/cancellation-and-refund" },
            ]}
          />
          
        </div>
        <div className="border-t border-secondary/20 px-4 py-5 text-left text-xs text-secondary/70 sm:px-5 md:px-8 md:text-center lg:px-12">
          Copyright {new Date().getFullYear()} NaariThread. All rights reserved.
        </div>
      </footer>

      <AnimatePresence>
        {showBackToTop ? (
          <motion.button
            type="button"
            aria-label="Back to top"
            onClick={scrollToTop}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.92 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.9 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-secondary/40 bg-primary text-secondary shadow-[0_12px_30px_rgba(120,0,0,0.35)] transition hover:-translate-y-0.5 hover:bg-primary/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:bottom-8 sm:left-8"
          >
            <DynamicHugeIcon
              name="PreviousIcon"
              className="h-5 w-5 rotate-90"
              iconStrokeWidth={2}
              aria-hidden={true}
            />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

type FooterLink = {
  label: string;
  href: string;
};

type FooterLinksProps = {
  title: string;
  links: FooterLink[];
};

function FooterLinks({ title, links }: FooterLinksProps) {
  return (
    <nav aria-label={`${title} links`} className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/90">{title}</p>
      <ul className="space-y-2.5 text-sm text-secondary/80">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              aria-label={link.label}
              className="thread-underline inline-flex items-center leading-relaxed"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
