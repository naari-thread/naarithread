"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { Skiper54, type SkiperImage } from "@/app/components/skiper54";

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

const heroImage = "/images/2.png";
const storyImage = "/images/pomelli-image-4%20(4).png";

const mostLovedSlides: SkiperImage[] = [
  {
    title: "Signature Festive Kurta",
    alt: "Indian woman in maroon and cream festive kurta set",
    src: "/images/pomelli-image-1.png",
  },
  {
    title: "Everyday Premium Line",
    alt: "Indian woman in premium daily wear ethnic set",
    src: "/images/3.png",
  },
  {
    title: "Wedding Guest Edit",
    alt: "Indian woman in elegant maroon occasion wear",
    src: "/images/pomelli-image-3.png",
  },
  {
    title: "Statement Embroidery",
    alt: "Indian woman in embroidered maroon kurta and palazzo",
    src: "/images/1.png",
  },
  {
    title: "Occasion Saree Edit",
    alt: "Woman in premium saree styling for festive event",
    src: "/images/pomelli-image-3%20(3).png",
  },
  {
    title: "Contemporary Fusion",
    alt: "Woman in indo-western contemporary silhouette",
    src: "/images/pomelli-image-1%20(4).png",
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
        image: "/images/pomelli-image-3%20(3).png",
        alt: "Model wearing an embroidered maroon saree",
      },
      {
        name: "Lehenga",
        slug: "lehenga",
        image: "/images/pomelli-image-1%20(2).png",
        alt: "Woman in lehenga-inspired festive silhouette",
      },
      {
        name: "Anarkali",
        slug: "anarkali",
        image: "/images/pomelli-image-4.png",
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
        image: "/images/pomelli-image-2%20(3).png",
        alt: "Woman in contemporary maroon dress-inspired look",
      },
      {
        name: "Tops",
        slug: "tops",
        image: "/images/pomelli-image-3%20(2).png",
        alt: "Woman styling a premium embroidered top",
      },
      {
        name: "Skirts",
        slug: "skirts",
        image: "/images/pomelli-image-1%20(3).png",
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
        image: "/images/pomelli-image-4%20(3).png",
        alt: "Woman styled in clean premium bottom-focused silhouette",
      },
      {
        name: "Trousers",
        slug: "trousers-pants",
        image: "/images/pomelli-image-2%20(4).png",
        alt: "Model wearing tailored cream trousers",
      },
      {
        name: "Palazzo",
        slug: "palazzo",
        image: "/images/pomelli-image-3%20(4).png",
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
        image: "/images/pomelli-image-1%20(4).png",
        alt: "Woman in premium indo-western dress styling",
      },
      {
        name: "Crop Top + Skirt",
        slug: "crop-top-skirt",
        image: "/images/pomelli-image-2.png",
        alt: "Woman in crop top and skirt-inspired fusion set",
      },
      {
        name: "Kurti + Jeans",
        slug: "kurti-jeans",
        image: "/images/pomelli-image-3.png",
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

  return (
    <main className="w-full">
      <section className="section-shell bg-secondary">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-5 py-20 md:px-8 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-12">
          <motion.div
            variants={revealContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="space-y-7"
          >
            <motion.h1
              variants={revealItem}
              className="font-display max-w-xl text-5xl font-semibold leading-tight text-primary sm:text-6xl lg:text-7xl"
            >
              Wear Your Story.
            </motion.h1>
            <motion.p
              variants={revealItem}
              className="max-w-xl text-lg leading-relaxed text-primary/85 sm:text-xl"
            >
              From the heritage of the Saree to the edge of Western wear, discover
              fashion that speaks your language.
            </motion.p>
            <motion.div variants={revealItem}>
              <Link
                href="/products"
                aria-label="Shop the NaariThread collection"
                className="cta-thread-hero"
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
            className="relative isolate mx-auto h-[74vh] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/5"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-secondary/50" />
            <Image
              src={heroImage}
              alt="NaariThread hero model in premium maroon and cream outfit"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="image-fade-enter object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/70 to-transparent p-6 text-secondary">
              <p className="text-xs uppercase tracking-[0.24em]">Signature Edit</p>
              <p className="mt-2 text-2xl font-semibold">Grace in Every Thread</p>
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
              <h2 className="font-display mt-3 text-3xl font-semibold sm:text-4xl lg:text-5xl">
                Best Seller Spotlight
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
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="py-1"
          >
            <Skiper54
              images={mostLovedSlides}
              className="mx-auto"
              autoplay={true}
              loop={true}
              showNavigation={true}
              showPagination={true}
            />
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
                <motion.div variants={revealItem} className="max-w-3xl">
                  <p
                    className={`text-xs uppercase tracking-[0.3em] ${
                      isMaroon ? "text-secondary/80" : "text-primary/70"
                    }`}
                  >
                    {category.eyebrow}
                  </p>
                  <h2 className="font-display mt-3 text-4xl font-semibold sm:text-5xl lg:text-6xl">{category.title}</h2>
                  <p className={`mt-4 text-lg ${isMaroon ? "text-secondary/85" : "text-primary/80"}`}>
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
                viewport={{ once: true, amount: 0.2 }}
                className={`grid grid-cols-1 gap-6 md:grid-cols-2 ${
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
                      <div className="relative h-[68vh] min-h-[460px] w-full overflow-hidden">
                        <Image
                          src={sub.image}
                          alt={sub.alt}
                          fill
                          loading="lazy"
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                          className="image-fade-enter object-cover object-top transition duration-700 group-hover:scale-[1.04]"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/55 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <span className="rounded-full border border-secondary/80 bg-primary/30 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                            Shop {sub.name}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`border-t px-5 py-4 ${
                          isMaroon
                            ? "border-secondary/25 bg-primary/50"
                            : "border-primary/15 bg-secondary/70"
                        }`}
                      >
                        <h3 className="text-xl font-semibold tracking-wide">{sub.name}</h3>
                        <p className={`mt-1 text-xs uppercase tracking-[0.2em] ${isMaroon ? "text-secondary/75" : "text-primary/70"}`}>
                          Curated in the {category.title} edit
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
            <motion.h2 variants={revealItem} className="text-4xl font-semibold text-primary sm:text-5xl">
              <span className="font-display">The Unbroken Thread</span>
            </motion.h2>
            <motion.p variants={revealItem} className="text-lg leading-relaxed text-primary/85">
              At NaariThread, we believe a woman&apos;s wardrobe is more than fabric;
              it is a story of where she comes from and where she is going. We
              started with a simple vision: create a space where the timeless grace
              of the Saree meets the effortless cool of the Jumpsuit.
            </motion.p>
            <motion.p variants={revealItem} className="text-lg leading-relaxed text-primary/85">
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
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 32, scale: 0.98 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-[68vh] min-h-[460px] overflow-hidden rounded-[2rem] border border-primary/20"
          >
            <Image
              src={storyImage}
              alt="Indian woman symbolizing tradition and modern ambition"
              fill
              loading="lazy"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="image-fade-enter object-cover object-top"
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
              <p className="font-display text-lg tracking-wide">NaariThread</p>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-secondary/80">
              Premium women clothing from heritage drapes to modern silhouettes, crafted
              for the modern Indian woman.
            </p>

            <div className="mt-5 space-y-2.5">
              <a
                href="tel:+918487849852"
                aria-label="Call NaariThread on +91 84878 49852"
                className="inline-flex items-center gap-2.5 text-sm text-secondary/80 transition hover:text-secondary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.62 5c-.09-1.17.8-2 1.97-2H6.5a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 10.5a16 16 0 0 0 5.59 5.59l1.86-1.84a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                +91 84878 49852
              </a>
              <a
                href="mailto:naarithread@gmail.com"
                aria-label="Email NaariThread at naarithread@gmail.com"
                className="inline-flex items-center gap-2.5 text-sm text-secondary/80 transition hover:text-secondary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                naarithread@gmail.com
              </a>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Visit NaariThread on Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-secondary/25 text-secondary/80 transition hover:border-secondary/60 hover:text-secondary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="https://wa.me/918487849852"
                target="_blank"
                rel="noreferrer"
                aria-label="Chat with NaariThread on WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-secondary/25 text-secondary/80 transition hover:border-secondary/60 hover:text-secondary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
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
            title="Company"
            links={[
              { label: "Our Story", href: "/#story" },
              { label: "Shop Collection", href: "/products" },
              { label: "Ethnic Wear", href: "/#ethnic" },
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
