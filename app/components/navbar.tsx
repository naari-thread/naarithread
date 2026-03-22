"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type NavSubCategory = {
  label: string;
  slug: string;
};

type NavCategory = {
  id: string;
  label: string;
  slug: string;
  note: string;
  subCategories: NavSubCategory[];
};

const navCategories: NavCategory[] = [
  {
    id: "ethnic",
    label: "Ethnic",
    slug: "ethnic-wear",
    note: "Sarees, Lehengas, Anarkalis",
    subCategories: [
      { label: "Saree", slug: "saree" },
      { label: "Lehenga", slug: "lehenga" },
      { label: "Anarkali", slug: "anarkali" },
    ],
  },
  {
    id: "western",
    label: "Western",
    slug: "western-wear",
    note: "Dresses, Tops, Skirts",
    subCategories: [
      { label: "Dresses", slug: "dresses" },
      { label: "Tops", slug: "tops" },
      { label: "Skirts", slug: "skirts" },
    ],
  },
  {
    id: "bottom",
    label: "Bottom",
    slug: "bottom-wear",
    note: "Jeans, Trousers, Palazzo",
    subCategories: [
      { label: "Jeans", slug: "jeans" },
      { label: "Trousers", slug: "trousers-pants" },
      { label: "Palazzo", slug: "palazzo" },
    ],
  },
  {
    id: "fusion",
    label: "Fusion",
    slug: "fusion-wear",
    note: "Indo-western statement sets",
    subCategories: [
      { label: "Indo-Western Dresses", slug: "indo-western-dresses" },
      { label: "Crop Top + Skirt", slug: "crop-top-skirt" },
      { label: "Kurti + Jeans", slug: "kurti-jeans" },
    ],
  },
];

function categoryHref(category: string, subcategory?: string) {
  const params = new URLSearchParams({ category });
  if (subcategory) {
    params.set("subcategory", subcategory);
  }
  return `/products?${params.toString()}`;
}

const menuContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const menuItem = {
  hidden: { opacity: 0, x: 14 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export function Navbar() {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [isHeroInView, setIsHeroInView] = useState(pathname === "/");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDesktopCategory, setActiveDesktopCategory] = useState<string | null>(null);
  const [activeMobileCategory, setActiveMobileCategory] = useState<string | null>(null);
  const closeDropdownTimer = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (pathname !== "/") return;

    const heroSection = document.getElementById("hero");
    if (!heroSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeroInView(entry.isIntersecting);
      },
      {
        threshold: 0.2,
        rootMargin: "-88px 0px 0px 0px",
      }
    );

    observer.observe(heroSection);

    return () => {
      observer.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (closeDropdownTimer.current) {
        window.clearTimeout(closeDropdownTimer.current);
      }
    };
  }, []);

  const showShopNow = pathname !== "/" || !isHeroInView;

  const openDesktopDropdown = (categoryId: string) => {
    if (closeDropdownTimer.current) {
      window.clearTimeout(closeDropdownTimer.current);
      closeDropdownTimer.current = null;
    }

    setActiveDesktopCategory(categoryId);
  };

  const closeDesktopDropdown = () => {
    if (closeDropdownTimer.current) {
      window.clearTimeout(closeDropdownTimer.current);
    }

    closeDropdownTimer.current = window.setTimeout(() => {
      setActiveDesktopCategory(null);
    }, 120);
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[95] transition-all duration-500 border-b border-primary/40 ${
          scrolled || isMobileMenuOpen
            ? "border-b border-primary/10 bg-secondary/90 shadow-[0_2px_24px_rgba(120,0,0,0.07)] backdrop-blur-md"
            : "bg-secondary/95 md:bg-transparent"
        }`}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-3 py-2 sm:px-5 sm:py-3 md:px-8 lg:px-12">
          <Link
            href="/"
            aria-label="NaariThread — return to homepage"
            className="group flex min-w-0 items-center gap-2"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Image
              src="/logo4.png"
              alt="NaariThread logo mark"
              width={80}
              height={80}
              priority
              className="h-11 w-11 rounded-full border border-primary/20 object-cover transition duration-300 group-hover:border-primary/50 group-hover:shadow-[0_0_0_3px_rgba(120,0,0,0.09)] sm:h-12 sm:w-12"
            />
            <Image
              src="/logoname2.png"
              alt="NaariThread logotype"
              width={128}
              height={128}
              className="mb-1 block h-8 w-auto object-contain sm:mb-2 sm:h-auto sm:w-auto"
            />
          </Link>

          <motion.nav
            aria-label="Categories"
            className="hidden items-center gap-6 md:flex lg:gap-8"
            initial={false}
            animate={prefersReducedMotion ? undefined : { x: showShopNow ? -22 : 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            {navCategories.map((category) => (
              <div
                key={category.id}
                className="relative"
                onMouseEnter={() => openDesktopDropdown(category.id)}
                onMouseLeave={closeDesktopDropdown}
                onFocus={() => openDesktopDropdown(category.id)}
                onBlur={closeDesktopDropdown}
              >
                <button
                  type="button"
                  aria-label={`Open ${category.label} dropdown`}
                  aria-expanded={activeDesktopCategory === category.id}
                  aria-haspopup="menu"
                  onClick={() =>
                    setActiveDesktopCategory((current) => (current === category.id ? null : category.id))
                  }
                  className="inline-flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-primary/85 transition hover:text-primary lg:text-[0.7rem]"
                >
                  {category.label}
                  <motion.span
                    className="inline-flex h-3.5 w-3.5 items-center justify-center"
                    initial={false}
                    animate={
                      prefersReducedMotion
                        ? undefined
                        : {
                            rotate: activeDesktopCategory === category.id ? 180 : 0,
                            y: activeDesktopCategory === category.id ? -0.2 : 0,
                          }
                    }
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <DynamicHugeIcon
                      name={activeDesktopCategory === category.id ? "PreviousIcon" : "ArrowRight01Icon"}
                      className="h-3.5 w-3.5 rotate-90 text-primary/75"
                      iconStrokeWidth={2}
                    />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {activeDesktopCategory === category.id ? (
                    <motion.div
                      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.98 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute left-1/2 top-full z-[130] mt-3 w-[280px] -translate-x-1/2 rounded-2xl border border-primary/12 bg-secondary p-4 shadow-[0_20px_42px_rgba(120,0,0,0.14)]"
                    >
                      {/* <p className="text-[0.58rem] font-semibold uppercase tracking-[0.25em] text-primary/60">
                        {category.label}
                      </p> */}
                      {/* <p className="mt-1.5 text-xs text-primary/75">{category.note}</p> */}
                      <div className="mt-3 flex flex-col gap-2">
                        {category.subCategories.map((subCategory) => (
                          <Link
                            key={`${category.id}-${subCategory.slug}`}
                            href={categoryHref(category.slug, subCategory.slug)}
                            aria-label={`Browse ${subCategory.label} in ${category.label}`}
                            className="group inline-flex items-center justify-between rounded-xl px-2.5 py-2 text-sm text-primary/80 transition hover:bg-primary/[0.06] hover:text-primary"
                            onClick={() => setActiveDesktopCategory(null)}
                          >
                            <span>{subCategory.label}</span>
                            <DynamicHugeIcon
                              name="ArrowRight01Icon"
                              className="h-3.5 w-3.5 text-primary/45 transition group-hover:translate-x-0.5 group-hover:text-primary/75"
                              iconStrokeWidth={2}
                            />
                          </Link>
                        ))}

                        <Link
                          href={categoryHref(category.slug)}
                          aria-label={`View all ${category.label}`}
                          className="group mt-1 inline-flex items-center justify-between rounded-xl border border-primary/20 bg-primary px-3.5 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-secondary transition hover:-translate-y-0.5 hover:border-primary hover:bg-primary/90"
                          onClick={() => setActiveDesktopCategory(null)}
                        >
                          <span>View All {category.label}</span>
                          <DynamicHugeIcon
                            name="ArrowRight01Icon"
                            className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                            iconStrokeWidth={2}
                          />
                        </Link>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ))}
          </motion.nav>

          <button
            type="button"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-sidebar-menu"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-secondary text-primary transition hover:border-primary/40 md:hidden"
          >
            <span className="sr-only">Toggle navigation menu</span>
            <span className="relative h-4 w-5">
              <span
                className={`absolute left-0 top-0 block h-[2px] w-5 rounded-full bg-primary transition-all duration-300 ${
                  isMobileMenuOpen ? "translate-y-[7px] rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-[7px] block h-[2px] w-5 rounded-full bg-primary transition-all duration-300 ${
                  isMobileMenuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 top-[14px] block h-[2px] w-5 rounded-full bg-primary transition-all duration-300 ${
                  isMobileMenuOpen ? "-translate-y-[7px] -rotate-45" : ""
                }`}
              />
            </span>
          </button>

          <AnimatePresence initial={false}>
            {showShopNow ? (
              <motion.div
                className="hidden lg:block"
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 18 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href="/products"
                  aria-label="Shop the NaariThread collection"
                  className="cta-thread px-4 py-2 text-[10px] tracking-[0.16em] sm:px-6 sm:text-xs sm:tracking-[0.2em]"
                >
                  Shop Now
                </Link>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {isMobileMenuOpen ? (
          <motion.div
            id="mobile-sidebar-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[120] bg-primary/45 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.aside
              initial={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
              }
              className="ml-auto flex h-full w-[92%] max-w-[430px] transform-gpu flex-col overflow-hidden rounded-l-[2rem] border-l border-primary/15 bg-secondary shadow-[-12px_0_40px_rgba(120,0,0,0.22)] [will-change:transform]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-primary/10 px-5 py-4">
                <Link
                  href="/"
                  aria-label="NaariThread — return to homepage"
                  className="group flex items-center gap-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Image
                    src="/logo4.png"
                    alt="NaariThread logo mark"
                    width={80}
                    height={80}
                    priority
                    className="h-11 w-11 rounded-full border border-primary/20 object-cover"
                  />
                  <Image
                    src="/logoname2.png"
                    alt="NaariThread logotype"
                    width={128}
                    height={128}
                    className="h-8 w-auto object-contain"
                  />
                </Link>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 text-primary transition hover:border-primary/40"
                >
                  <span className="relative h-4 w-4">
                    <span className="absolute left-0 top-[7px] block h-[2px] w-4 rotate-45 rounded-full bg-primary" />
                    <span className="absolute left-0 top-[7px] block h-[2px] w-4 -rotate-45 rounded-full bg-primary" />
                  </span>
                </button>
              </div>

              <motion.nav
                aria-label="Mobile landing page sections"
                variants={menuContainer}
                initial="hidden"
                animate="show"
                className="flex flex-1 flex-col px-5 pb-8 pt-6"
              >
                {/* <motion.div variants={menuItem} className="mb-5 rounded-2xl border border-primary/12 bg-primary/[0.03] px-4 py-3">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-primary/60">Browse By Style</p>
                  <p className="mt-1 text-sm leading-snug text-primary/80">Find your perfect look across heritage and modern edits.</p>
                </motion.div> */}

                <div className="flex flex-col gap-3">
                  {navCategories.map((category) => {
                    const isOpen = activeMobileCategory === category.id;

                    return (
                      <motion.div
                        key={`mobile-item-${category.id}`}
                        variants={menuItem}
                        className="overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.04]"
                      >
                        <button
                          type="button"
                          aria-label={`Open ${category.label} category links`}
                          aria-expanded={isOpen}
                          onClick={() =>
                            setActiveMobileCategory((current) => (current === category.id ? null : category.id))
                          }
                          className="flex min-h-[68px] w-full items-center justify-between px-4 py-3 text-left"
                        >
                          <span className="block">
                            <span className="block text-[0.75rem] font-semibold uppercase tracking-[0.24em] text-primary/90">
                              {category.label}
                            </span>
                            <span className="mt-1 block text-xs text-primary/65">{category.note}</span>
                          </span>
                          <span
                            aria-hidden="true"
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/20 text-primary/70 transition-transform duration-300 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          >
                            <DynamicHugeIcon name="ArrowRight01Icon" className="h-3.5 w-3.5 rotate-90" iconStrokeWidth={2} />
                          </span>
                        </button>

                        <AnimatePresence initial={false}>
                          {isOpen ? (
                            <motion.div
                              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden border-t border-primary/12"
                            >
                              <div className="flex flex-col gap-1.5 px-3 py-3">
                                {category.subCategories.map((subCategory) => (
                                  <Link
                                    key={`mobile-${category.id}-${subCategory.slug}`}
                                    href={categoryHref(category.slug, subCategory.slug)}
                                    aria-label={`Browse ${subCategory.label} in ${category.label}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="group inline-flex items-center justify-between rounded-xl px-3 py-2 text-sm text-primary/80 transition hover:bg-primary/[0.08] hover:text-primary"
                                  >
                                    <span>{subCategory.label}</span>
                                    <DynamicHugeIcon
                                      name="ArrowRight01Icon"
                                      className="h-3.5 w-3.5 text-primary/50 transition group-hover:translate-x-0.5 group-hover:text-primary"
                                      iconStrokeWidth={2}
                                    />
                                  </Link>
                                ))}

                                <Link
                                  href={categoryHref(category.slug)}
                                  aria-label={`View all ${category.label}`}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className="group mt-2 inline-flex items-center justify-between rounded-xl border border-primary/20 bg-primary px-3.5 py-2.5 text-[0.67rem] font-semibold uppercase tracking-[0.18em] text-secondary"
                                >
                                  <span>View All {category.label}</span>
                                  <DynamicHugeIcon
                                    name="ArrowRight01Icon"
                                    className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                                    iconStrokeWidth={2}
                                  />
                                </Link>
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>

                <motion.div variants={menuItem} className="mt-auto pt-8">
                  <Link
                    href="/products"
                    aria-label="Shop the NaariThread collection"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="cta-thread inline-flex w-full items-center justify-center px-4 py-2 text-[11px] tracking-[0.18em]"
                  >
                    Shop Now
                  </Link>
                </motion.div>
              </motion.nav>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
