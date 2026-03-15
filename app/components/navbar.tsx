"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

const sectionLinks = [
  { label: "Ethnic", href: "/#ethnic", note: "Sarees, Lehengas, Anarkalis" },
  { label: "Western", href: "/#western", note: "Dresses, Tops, Skirts" },
  { label: "Bottom", href: "/#bottoms", note: "Jeans, Trousers, Palazzo" },
  { label: "Fusion", href: "/#fusion", note: "Indo-western statement sets" },
];

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

  const showShopNow = pathname !== "/" || !isHeroInView;

  const handleSectionLinkClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("/#")) {
      return;
    }

    const targetId = href.replace("/#", "");

    if (pathname !== "/") {
      setIsMobileMenuOpen(false);
      return;
    }

    event.preventDefault();
    const targetSection = document.getElementById(targetId);

    if (!targetSection) {
      setIsMobileMenuOpen(false);
      return;
    }

    const targetTop = targetSection.getBoundingClientRect().top + window.scrollY - 84;
    window.history.replaceState(null, "", `/#${targetId}`);
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    setIsMobileMenuOpen(false);
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

          <nav aria-label="Landing page sections" className="hidden items-center gap-6 md:flex lg:gap-8">
            {sectionLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-label={`Go to ${link.label} section`}
                onClick={(event) => handleSectionLinkClick(event, link.href)}
                className="thread-underline text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-primary/85 transition hover:text-primary lg:text-[0.7rem]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

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

          {showShopNow ? (
            <div className="hidden lg:block">
              <Link
                href="/products"
                aria-label="Shop the NaariThread collection"
                className="cta-thread px-4 py-2 text-[10px] tracking-[0.16em] sm:px-6 sm:text-xs sm:tracking-[0.2em]"
              >
                Shop Now
              </Link>
            </div>
          ) : null}
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
            className="fixed inset-0 z-[120] bg-primary/45 backdrop-blur-[2px] md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.aside
              initial={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 360, damping: 34, mass: 0.8 }
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
                <motion.div variants={menuItem} className="mb-5 rounded-2xl border border-primary/12 bg-primary/[0.03] px-4 py-3">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-primary/60">Browse By Style</p>
                  <p className="mt-1 text-sm leading-snug text-primary/80">Find your perfect look across heritage and modern edits.</p>
                </motion.div>

                <div className="flex flex-col gap-3">
                  {sectionLinks.map((link) => (
                    <motion.div key={`mobile-item-${link.href}`} variants={menuItem}>
                      <Link
                        href={link.href}
                        aria-label={`Go to ${link.label} section`}
                        onClick={(event) => handleSectionLinkClick(event, link.href)}
                        className="group inline-flex min-h-[68px] w-full items-center justify-between rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3 text-left transition duration-300 hover:border-primary/35"
                      >
                        <span className="block">
                          <span className="block text-[0.75rem] font-semibold uppercase tracking-[0.24em] text-primary/90">
                            {link.label}
                          </span>
                          <span className="mt-1 block text-xs text-primary/65">{link.note}</span>
                        </span>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/20 text-primary/65 transition group-hover:translate-x-0.5 group-hover:border-primary/45 group-hover:text-primary">
                          <DynamicHugeIcon name="ArrowRight01Icon" className="h-3.5 w-3.5" iconStrokeWidth={2} />
                        </span>
                      </Link>
                    </motion.div>
                  ))}
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
