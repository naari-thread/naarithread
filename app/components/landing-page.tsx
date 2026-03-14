"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

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

const bestSellers = [
  {
    title: "Carmine Saree Drape",
    subtitle: "Limited festive edit",
    image:
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=1400&q=80",
    alt: "Woman in a flowing red saree in motion",
    href: "/products?tag=bestseller",
  },
  {
    title: "Urban Kurti Line",
    subtitle: "Daily comfort. Premium finish.",
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1400&q=80",
    alt: "Woman walking in a modern kurti",
    href: "/products?tag=trending",
  },
  {
    title: "Evening Fusion Set",
    subtitle: "Indo-western signature",
    image:
      "https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80",
    alt: "Woman in elegant fusion attire outdoors",
    href: "/products?tag=editor-pick",
  },
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
        image:
          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=80",
        alt: "Model wearing an embroidered saree",
      },
      {
        name: "Lehenga",
        slug: "lehenga",
        image:
          "https://images.unsplash.com/photo-1623609163859-ca93c959b98a?auto=format&fit=crop&w=1200&q=80",
        alt: "Woman in a festive lehenga twirl",
      },
      {
        name: "Anarkali",
        slug: "anarkali",
        image:
          "https://images.unsplash.com/photo-1583391733956-6c77a3d0d415?auto=format&fit=crop&w=1200&q=80",
        alt: "Woman wearing an anarkali suit in a courtyard",
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
        image:
          "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
        alt: "Woman in a flowing contemporary dress",
      },
      {
        name: "Tops",
        slug: "tops",
        image:
          "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80",
        alt: "Woman styling a modern top and layered jewelry",
      },
      {
        name: "Skirts",
        slug: "skirts",
        image:
          "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1200&q=80",
        alt: "Woman walking in a pleated skirt",
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
        image:
          "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1200&q=80",
        alt: "Woman wearing relaxed denim jeans",
      },
      {
        name: "Trousers",
        slug: "trousers-pants",
        image:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
        alt: "Model wearing tailored high-waist trousers",
      },
      {
        name: "Palazzo",
        slug: "palazzo",
        image:
          "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80",
        alt: "Woman in flowing palazzo pants",
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
        image:
          "https://images.unsplash.com/photo-1521577352947-9bb58764b69a?auto=format&fit=crop&w=1200&q=80",
        alt: "Woman in indo-western evening attire",
      },
      {
        name: "Crop Top + Skirt",
        slug: "crop-top-skirt",
        image:
          "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1200&q=80",
        alt: "Woman in crop top and skirt set",
      },
      {
        name: "Kurti + Jeans",
        slug: "kurti-jeans",
        image:
          "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
        alt: "Woman wearing kurti styled with denim",
      },
    ],
  },
];

const revealContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.12,
    },
  },
};

const revealItem = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
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

  return (
    <main className="w-full">
      <section className="section-shell bg-secondary">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-5 py-20 md:px-8 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-12">
          <motion.div
            variants={revealContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="space-y-6"
          >
            <motion.div variants={revealItem} className="inline-flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="NaariThread logo"
                width={42}
                height={42}
                priority
                className="h-10 w-10 rounded-full border border-primary/30 object-cover"
              />
              <span className="text-xs font-semibold uppercase tracking-[0.34em] text-primary">
                NaariThread
              </span>
            </motion.div>
            <motion.h1
              variants={revealItem}
              className="max-w-xl text-4xl font-semibold leading-tight text-primary sm:text-5xl lg:text-6xl"
            >
              Wear Your Story.
            </motion.h1>
            <motion.p
              variants={revealItem}
              className="max-w-xl text-base leading-relaxed text-primary/85 sm:text-lg"
            >
              From the heritage of the Saree to the edge of Western wear, discover
              fashion that speaks your language.
            </motion.p>
            <motion.div variants={revealItem} className="flex flex-wrap items-center gap-4">
              <Link
                href="/products"
                aria-label="Shop the NaariThread collection"
                className="cta-thread"
              >
                Shop the Collection
              </Link>
              <Link
                href="#story"
                aria-label="Read the NaariThread brand story"
                className="thread-underline text-sm font-semibold uppercase tracking-[0.2em] text-primary"
              >
                Why NaariThread
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative isolate mx-auto h-[68vh] w-full max-w-xl overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/5"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-secondary/60" />
            <Image
              src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1600&q=80"
              alt="Woman in motion wearing premium contemporary Indian attire"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/70 to-transparent p-5 text-secondary">
              <p className="text-xs uppercase tracking-[0.24em]">Signature Edit</p>
              <p className="mt-2 text-xl font-semibold">Grace in Every Thread</p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-shell bg-primary text-secondary">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 md:px-8 lg:px-12">
          <motion.div
            variants={revealContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
          >
            <motion.div variants={revealItem}>
              <p className="text-xs uppercase tracking-[0.34em] text-secondary/80">Most Loved</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Best Selling Moving Looks
              </h2>
            </motion.div>
            <motion.div variants={revealItem}>
              <Link
                href="/products?sort=popular"
                aria-label="Explore all best selling products"
                className="thread-underline text-sm font-semibold uppercase tracking-[0.2em] text-secondary"
              >
                Explore Best Sellers
              </Link>
            </motion.div>
          </motion.div>
          <motion.div
            variants={revealContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
          >
            {bestSellers.map((card) => (
              <motion.article
                key={card.title}
                variants={revealItem}
                className="group overflow-hidden rounded-3xl border border-secondary/30 bg-secondary/10 backdrop-blur"
              >
                <Link href={card.href} aria-label={`Open ${card.title} collection`} className="block">
                  <div className="relative h-72 w-full overflow-hidden">
                    <Image
                      src={card.image}
                      alt={card.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="space-y-1 p-5">
                    <h3 className="text-xl font-semibold">{card.title}</h3>
                    <p className="text-sm text-secondary/85">{card.subtitle}</p>
                  </div>
                </Link>
              </motion.article>
            ))}
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
            <div className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8 lg:px-12">
              <motion.div
                variants={revealContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.15 }}
                className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
              >
                <motion.div variants={revealItem} className="max-w-2xl">
                  <p
                    className={`text-xs uppercase tracking-[0.3em] ${
                      isMaroon ? "text-secondary/80" : "text-primary/70"
                    }`}
                  >
                    {category.eyebrow}
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                    {category.title}
                  </h2>
                  <p className={`mt-4 text-base ${isMaroon ? "text-secondary/85" : "text-primary/80"}`}>
                    {category.body}
                  </p>
                </motion.div>
                <motion.div variants={revealItem}>
                  <Link
                    href={categoryHref(category.slug)}
                    aria-label={`View all ${category.title} products`}
                    className={`thread-underline text-sm font-semibold uppercase tracking-[0.22em] ${
                      isMaroon ? "text-secondary" : "text-primary"
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
                viewport={{ once: true, amount: 0.15 }}
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
              >
                {category.subCategories.map((sub) => (
                  <motion.article
                    key={sub.slug}
                    variants={revealItem}
                    className={`group overflow-hidden rounded-3xl border ${
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
                      <div className="relative h-72 w-full overflow-hidden bg-fixed">
                        <Image
                          src={sub.image}
                          alt={sub.alt}
                          fill
                          loading="lazy"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className={`object-cover transition duration-700 group-hover:scale-105 ${
                            prefersReducedMotion ? "" : "group-hover:-translate-y-1"
                          }`}
                        />
                      </div>
                      <div className="space-y-2 p-5">
                        <h3 className="text-xl font-semibold">
                          <span className="thread-underline">{sub.name}</span>
                        </h3>
                        <p className={`text-sm ${isMaroon ? "text-secondary/85" : "text-primary/75"}`}>
                          Move through your day in signature NaariThread confidence.
                        </p>
                      </div>
                    </Link>
                  </motion.article>
                ))}
              </motion.div>

              {index === categories.length - 1 ? (
                <motion.div
                  variants={revealItem}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                  className="mt-10"
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
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-5 py-20 md:px-8 lg:grid-cols-2 lg:gap-12 lg:px-12">
          <motion.div
            variants={revealContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="space-y-4"
          >
            <motion.p
              variants={revealItem}
              className="text-xs font-semibold uppercase tracking-[0.34em] text-primary/70"
            >
              The Story
            </motion.p>
            <motion.h2 variants={revealItem} className="text-3xl font-semibold text-primary sm:text-4xl">
              The Unbroken Thread
            </motion.h2>
            <motion.p variants={revealItem} className="text-base leading-relaxed text-primary/85">
              At NaariThread, we believe a woman&apos;s wardrobe is more than fabric;
              it is a story of where she comes from and where she is going. We
              started with a simple vision: create a space where the timeless grace
              of the Saree meets the effortless cool of the Jumpsuit.
            </motion.p>
            <motion.p variants={revealItem} className="text-base leading-relaxed text-primary/85">
              Our name represents the thread that connects generations, from the
              artisan&apos;s hand to the modern woman&apos;s hustle. Whether you are draped
              in six yards of tradition or stepping out in fusion wear,
              NaariThread ensures your style is as resilient and beautiful as the
              thread that binds us all.
            </motion.p>
            <motion.div variants={revealItem} className="pt-2">
              <Link href="/products" aria-label="Start shopping NaariThread products" className="cta-thread">
                Start Shopping
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 32 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-[58vh] min-h-[420px] overflow-hidden rounded-[2rem] border border-primary/20"
          >
            <Image
              src="https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?auto=format&fit=crop&w=1400&q=80"
              alt="Indian woman in motion symbolizing tradition and modern ambition"
              fill
              loading="lazy"
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
          </motion.div>
        </div>
      </section>

      <footer className="bg-primary text-secondary">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-5 py-14 md:grid-cols-2 md:px-8 lg:grid-cols-6 lg:px-12">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="NaariThread footer logo"
                width={40}
                height={40}
                className="h-10 w-10 rounded-full border border-secondary/30 object-cover"
              />
              <p className="text-lg font-semibold tracking-wide">NaariThread</p>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-secondary/80">
              Premium women clothing from heritage drapes to modern silhouettes, now
              online for India and beyond.
            </p>
            <Link
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Visit NaariThread Instagram page"
              className="thread-underline mt-5 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-secondary"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              Instagram
            </Link>
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
            title="Company"
            links={[
              { label: "Our Story", href: "/#story" },
              { label: "Why NaariThread", href: "/#story" },
              { label: "Shop Collection", href: "/products" },
              { label: "Category Highlights", href: "/#ethnic" },
            ]}
          />
          <FooterLinks
            title="Policies"
            links={[
              { label: "Shipping Policy", href: "/policies/shipping" },
              { label: "Return Policy", href: "/policies/returns" },
              { label: "Terms & Conditions", href: "/policies/terms-and-conditions" },
              { label: "Privacy Policy", href: "/policies/privacy" },
              { label: "Cancellation & Refund", href: "/policies/cancellation-and-refund" },
            ]}
          />
        </div>
        <div className="border-t border-secondary/20 px-5 py-5 text-center text-xs text-secondary/70 md:px-8 lg:px-12">
          Copyright {new Date().getFullYear()} NaariThread. All rights reserved.
        </div>
      </footer>
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
    <nav aria-label={`${title} links`}>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/90">{title}</p>
      <ul className="mt-4 space-y-2 text-sm text-secondary/80">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              aria-label={link.label}
              className="thread-underline inline-flex items-center"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
