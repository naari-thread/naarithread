"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthModal } from "@/app/components/auth-modal";
import { useAuth } from "@/app/components/auth-provider";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { AccountDetailsModal } from "@/app/components/account-details-modal";
import { OrdersDetailsModal } from "@/app/components/orders-details-modal";
import { WalletDetailsModal } from "@/app/components/wallet-details-modal";
import { getCartItemsCount, readCartItems, subscribeToCartChanges } from "@/lib/cart-state";
import { getWishlistItemsCount, readWishlistItems, subscribeToWishlistChanges } from "@/lib/wishlist-state";

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

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
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

const sampleNotifications: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Your cart is waiting",
    body: "You still have selected items in cart. Complete checkout before stock changes.",
    createdAt: "2m ago",
  },
  {
    id: "notif-2",
    title: "Festive offer unlocked",
    body: "Use code NAARI20 on eligible products and save more on this order.",
    createdAt: "1h ago",
  },
  {
    id: "notif-3",
    title: "New arrivals in Saree",
    body: "Fresh saree styles are now live. Explore latest color and drape edits.",
    createdAt: "5h ago",
  },
  {
    id: "notif-4",
    title: "Order support update",
    body: "Support team response time improved. Reach us directly from account page.",
    createdAt: "1d ago",
  },
  {
    id: "notif-5",
    title: "Wishlist reminder",
    body: "Some wishlist products are low in stock. Review before they sell out.",
    createdAt: "2d ago",
  },
];

function categoryHref(category: string, subcategory?: string) {
  if (subcategory) {
    return `/products/${category}/${subcategory}`;
  }

  return `/products/${category}`;
}

const menuContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
};

const menuItem = {
  hidden: { opacity: 0, x: 14 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.18,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export function Navbar() {
  const { isAuthenticated, isLoading, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const isLandingPage = pathname === "/";
  const [isMounted, setIsMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isHeroInView, setIsHeroInView] = useState(pathname === "/");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Non-landing pages mobile drawer state
  const [isQuickDrawerOpen, setIsQuickDrawerOpen] = useState(false);
  const [activeDesktopCategory, setActiveDesktopCategory] = useState<string | null>(null);
  const [activeMobileCategory, setActiveMobileCategory] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedAccountAction, setSelectedAccountAction] = useState<"account" | "wallet" | "orders" | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const closeDropdownTimer = useRef<number | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const accountPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsMounted(true);
      setCartCount(getCartItemsCount(readCartItems()));
      setWishlistCount(getWishlistItemsCount(readWishlistItems()));
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const overflow = isMobileMenuOpen || isQuickDrawerOpen;
    if (!overflow) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen, isQuickDrawerOpen]);

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
    return subscribeToCartChanges((items) => {
      setCartCount(getCartItemsCount(items));
    });
  }, []);

  useEffect(() => {
    return subscribeToWishlistChanges((items) => {
      setWishlistCount(getWishlistItemsCount(items));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (closeDropdownTimer.current) {
        window.clearTimeout(closeDropdownTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!notificationPanelRef.current) {
        return;
      }

      if (!notificationPanelRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }

      if (accountPanelRef.current && !accountPanelRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
        setIsAccountMenuOpen(false);
        setSelectedNotification(null);
        setSelectedAccountAction(null);
        setIsQuickDrawerOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const isProductsRoute = pathname.startsWith("/products");
  const desktopQuickLinks = [
    {
      href: "/products",
      label: "Shop",
      icon: "ShoppingBag01Icon" as const,
      isActive: isProductsRoute,
    },
    {
      href: "/wishlist",
      label: "Wishlist",
      icon: "FavouriteIcon" as const,
      isActive: pathname.startsWith("/wishlist"),
      badgeCount: isMounted ? wishlistCount : 0,
    },
    {
      href: "/cart",
      label: "Cart",
      icon: "ShoppingCart02Icon" as const,
      isActive: pathname.startsWith("/cart"),
      badgeCount: isMounted ? cartCount : 0,
    },
  ];

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
      {/* ─── LANDING PAGE NAVBAR ─── */}
      {isLandingPage && (
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

            {/* Desktop: Category Nav */}
            <motion.nav
              aria-label="Categories"
              className="hidden items-center gap-6 md:flex lg:gap-8"
              initial={false}
              animate={prefersReducedMotion ? undefined : { x: 0 }}
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
                        <div className="mt-3 flex max-h-[22rem] flex-col gap-2 overflow-y-auto overscroll-contain pr-1" onWheel={(event) => event.stopPropagation()}>
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

            {/* Desktop: 3 Icon Buttons (always visible on landing page) */}
            <nav aria-label="Quick actions" className="hidden items-center gap-2 md:flex">
              {desktopQuickLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-label={`Open ${item.label}`}
                  aria-current={item.isActive ? "page" : undefined}
                  className={`group relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                    item.isActive
                      ? "border-transparent text-secondary"
                      : "border-primary/20 bg-secondary text-primary/80 hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  {item.isActive && (
                    <motion.div
                      layoutId="active-landing-nav-icon"
                      className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_16px_rgba(120,0,0,0.18)]"
                      initial={false}
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      aria-hidden="true"
                    />
                  )}
                  <DynamicHugeIcon
                    name={item.icon}
                    className="relative z-10 h-5 w-5"
                    iconStrokeWidth={item.isActive ? 2.2 : 2}
                  />
                  {typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
                    <span
                      className={`absolute right-0 top-0 -translate-y-[20%] translate-x-[20%] z-20 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[0.54rem] font-bold leading-none ring-2 ring-secondary ${
                        item.isActive ? "bg-secondary text-primary" : "bg-primary text-secondary"
                      }`}
                      aria-hidden={true}
                    >
                      {item.badgeCount > 9 ? "9+" : item.badgeCount}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>

            {/* Mobile: Hamburger (landing page — opens category drawer) */}
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
          </div>
        </header>
      )}

      {/* ─── NON-LANDING PAGE NAVBAR ─── */}
      {!isLandingPage && (
        <header
          className={`fixed inset-x-0 top-0 z-[95] transition-all duration-500 ${
            scrolled
              ? "border-b border-primary/10 bg-secondary/90 shadow-[0_2px_24px_rgba(120,0,0,0.07)] backdrop-blur-md"
              : "border-b border-primary/10 bg-secondary/95 backdrop-blur-sm"
          }`}
        >
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-3 py-2 sm:px-5 sm:py-3 md:px-8 lg:px-12">
            <Link
              href="/"
              aria-label="NaariThread — return to homepage"
              className="group flex min-w-0 items-center gap-2"
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

            <nav aria-label="Quick links" className="hidden items-center gap-2 md:flex">
              {desktopQuickLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-label={`Open ${item.label}`}
                  aria-current={item.isActive ? "page" : undefined}
                  className={`group relative inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] transition ${
                    item.isActive
                      ? "text-secondary"
                      : "text-primary/80 hover:text-primary"
                  }`}
                >
                  <div className={`absolute inset-0 rounded-full border pointer-events-none transition duration-300 ${item.isActive ? "border-transparent" : "border-primary/20 bg-secondary group-hover:border-primary/40"}`} aria-hidden="true" />
                  {item.isActive && (
                    <motion.div
                      layoutId="active-desktop-nav-link"
                      className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_16px_rgba(120,0,0,0.18)]"
                      initial={false}
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      aria-hidden="true"
                    />
                  )}
                  <DynamicHugeIcon
                    name={item.icon}
                    className="relative z-10 h-4.5 w-4.5"
                    iconStrokeWidth={item.isActive ? 2.2 : 2}
                  />
                  <span className="relative z-10">{item.label}</span>
                  {typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
                    <span
                      className={`absolute right-0 top-0 -translate-y-[20%] translate-x-[20%] z-20 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[0.54rem] font-bold leading-none ring-2 ring-secondary ${
                        item.isActive ? "bg-secondary text-primary" : "bg-primary text-secondary"
                      }`}
                      aria-hidden={true}
                    >
                      {item.badgeCount > 9 ? "9+" : item.badgeCount}
                    </span>
                  ) : null}
                </Link>
              ))}

              <div className="relative" ref={notificationPanelRef}>
                <button
                  type="button"
                  aria-label="Open notifications"
                  aria-expanded={isNotificationsOpen}
                  onClick={() => {
                    setIsNotificationsOpen((prev) => !prev);
                    setIsAccountMenuOpen(false);
                  }}
                  className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-secondary text-primary/75 transition hover:border-primary/40 hover:text-primary"
                >
                  <DynamicHugeIcon
                    name="Notification01Icon"
                    className="relative z-10 h-5.5 w-5.5"
                    iconStrokeWidth={2.1}
                  />
                  <span
                    className="absolute right-0 top-0 -translate-y-[20%] translate-x-[20%] z-20 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.54rem] font-bold leading-none text-secondary ring-2 ring-secondary"
                    aria-hidden={true}
                  >
                    {sampleNotifications.length > 9 ? "9+" : sampleNotifications.length}
                  </span>
                </button>

                <AnimatePresence>
                  {isNotificationsOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute right-0 top-[calc(100%+10px)] z-[130] w-[320px] overflow-hidden rounded-2xl border border-primary/14 bg-secondary shadow-[0_20px_42px_rgba(120,0,0,0.16)]"
                    >
                      <div className="border-b border-primary/10 px-4 py-3">
                        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-primary/62">Notifications</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto overscroll-contain p-2" onWheel={(event) => event.stopPropagation()}>
                        {sampleNotifications.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            aria-label={`Open notification: ${notification.title}`}
                            onClick={() => {
                              setSelectedNotification(notification);
                              setIsNotificationsOpen(false);
                            }}
                            className="mb-1 w-full rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-primary/12 hover:bg-primary/[0.04]"
                          >
                            <p className="text-sm font-semibold text-primary">{notification.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-primary/72">{notification.body}</p>
                            <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-primary/55">{notification.createdAt}</p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="relative" ref={accountPanelRef}>
                <button
                  type="button"
                  aria-label="Open account menu"
                  aria-expanded={isAccountMenuOpen}
                  onClick={() => {
                    if (!isAuthenticated && !isLoading) {
                      setIsAuthModalOpen(true);
                      return;
                    }
                    setIsAccountMenuOpen((prev) => !prev);
                    setIsNotificationsOpen(false);
                  }}
                  className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-secondary text-primary/75 transition hover:border-primary/40 hover:text-primary"
                >
                  <DynamicHugeIcon name="UserIcon" className="h-5.5 w-5.5" iconStrokeWidth={2.1} />
                </button>

                <AnimatePresence>
                  {isAuthenticated && isAccountMenuOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute right-0 top-[calc(100%+10px)] z-[130] w-[220px] rounded-2xl border border-primary/14 bg-secondary p-2 shadow-[0_20px_42px_rgba(120,0,0,0.16)]"
                    >
                      <button
                        type="button"
                        aria-label="Open account details"
                        onClick={() => {
                          setSelectedAccountAction("account");
                          setIsAccountMenuOpen(false);
                        }}
                        className="mb-1 inline-flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm text-primary/82 transition hover:bg-primary/[0.04]"
                      >
                        <span>Account</span>
                        <DynamicHugeIcon name="ArrowRight01Icon" className="h-4 w-4" iconStrokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        aria-label="Open wallet details"
                        onClick={() => {
                          setSelectedAccountAction("wallet");
                          setIsAccountMenuOpen(false);
                        }}
                        className="mb-1 inline-flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm text-primary/82 transition hover:bg-primary/[0.04]"
                      >
                        <span>Wallet</span>
                        <DynamicHugeIcon name="ArrowRight01Icon" className="h-4 w-4" iconStrokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        aria-label="Open orders"
                        onClick={() => {
                          setSelectedAccountAction("orders");
                          setIsAccountMenuOpen(false);
                        }}
                        className="mb-1 inline-flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm text-primary/82 transition hover:bg-primary/[0.04]"
                      >
                        <span>Orders</span>
                        <DynamicHugeIcon name="ArrowRight01Icon" className="h-4 w-4" iconStrokeWidth={2} />
                      </button>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setIsAccountMenuOpen(false)}
                          className="mb-1 inline-flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm text-primary/82 transition hover:bg-primary/[0.04]"
                          aria-label="Open admin panel"
                        >
                          <span>Admin Panel</span>
                          <DynamicHugeIcon name="ArrowRight01Icon" className="h-4 w-4" iconStrokeWidth={2} />
                        </Link>
                      )}
                      <button
                        type="button"
                        aria-label="Logout from account"
                        onClick={() => {
                          void logout();
                          setIsAccountMenuOpen(false);
                        }}
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-primary/20 text-xs font-semibold uppercase tracking-[0.18em] text-primary transition hover:border-primary/40"
                      >
                        Logout
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </nav>

            {/* Mobile: Hamburger (non-landing page — opens Quick Drawer) */}
            <button
              type="button"
              aria-label={isQuickDrawerOpen ? "Close menu" : "Open menu"}
              aria-expanded={isQuickDrawerOpen}
              aria-controls="mobile-quick-drawer"
              onClick={() => setIsQuickDrawerOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-secondary text-primary transition hover:border-primary/40 md:hidden"
            >
              <span className="sr-only">Toggle navigation menu</span>
              <span className="relative h-4 w-5">
                <span
                  className={`absolute left-0 top-0 block h-[2px] w-5 rounded-full bg-primary transition-all duration-300 ${
                    isQuickDrawerOpen ? "translate-y-[7px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`absolute left-0 top-[7px] block h-[2px] w-5 rounded-full bg-primary transition-all duration-300 ${
                    isQuickDrawerOpen ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 top-[14px] block h-[2px] w-5 rounded-full bg-primary transition-all duration-300 ${
                    isQuickDrawerOpen ? "-translate-y-[7px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </header>
      )}

      {/* ─── MOBILE QUICK DRAWER TRIGGER (non-landing pages, desktop-only fallback) ─── */}
      {!isLandingPage && (
        <div className="fixed top-3 right-3 z-[95] hidden">
          {/* Retained for programmatic access; mobile now uses the navbar hamburger */}
        </div>
      )}

      {/* ─── MODAL LAYER (notifications / account details) ─── */}
      <AnimatePresence initial={false}>
        {selectedNotification || selectedAccountAction ? (
          <motion.div
            className="fixed inset-0 z-[160] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setSelectedNotification(null);
              setSelectedAccountAction(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md max-h-[80vh] rounded-2xl border border-primary/15 bg-secondary p-3 sm:p-4 shadow-[0_20px_48px_rgba(120,0,0,0.2)] flex flex-col"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal={true}
              aria-label={selectedNotification ? "Notification details" : "Account details"}
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3 shrink-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.6rem] sm:text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary/58">
                    {selectedNotification ? "Notification" : "Account"}
                  </p>
                  <h3 className="mt-1 text-base sm:text-lg font-semibold text-primary truncate">
                    {selectedNotification
                      ? selectedNotification.title
                      : selectedAccountAction === "wallet"
                        ? "Wallet"
                        : selectedAccountAction === "orders"
                          ? "Orders"
                        : "My Account"}
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Close details modal"
                  onClick={() => {
                    setSelectedNotification(null);
                    setSelectedAccountAction(null);
                  }}
                  className="inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-primary/18 text-primary transition hover:border-primary/35"
                >
                  <DynamicHugeIcon name="Cancel01Icon" className="h-4 w-4 sm:h-4.5 sm:w-4.5" iconStrokeWidth={2.2} aria-hidden={true} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden mt-2 sm:mt-3">
                {selectedNotification ? (
                  <div className="space-y-3 overflow-y-auto overscroll-contain h-full">
                    <p className="text-xs sm:text-sm leading-relaxed text-primary/82">{selectedNotification.body}</p>
                    <p className="text-[0.6rem] sm:text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary/56">
                      {selectedNotification.createdAt}
                    </p>
                  </div>
                ) : selectedAccountAction === "account" ? (
                  <div className="overflow-y-auto overscroll-contain h-full">
                    <AccountDetailsModal
                      onClose={() => {
                        setSelectedNotification(null);
                        setSelectedAccountAction(null);
                      }}
                      showLogout={true}
                    />
                  </div>
                ) : selectedAccountAction === "wallet" ? (
                  <div className="overflow-y-auto overscroll-contain h-full">
                    <WalletDetailsModal
                      onClose={() => {
                        setSelectedNotification(null);
                        setSelectedAccountAction(null);
                      }}
                    />
                  </div>
                ) : selectedAccountAction === "orders" ? (
                  <div className="overflow-y-auto overscroll-contain h-full">
                    <OrdersDetailsModal
                      onClose={() => {
                        setSelectedNotification(null);
                        setSelectedAccountAction(null);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {/* ─── MOBILE CATEGORY DRAWER (all pages) ─── */}
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
                              <div className="flex max-h-[18rem] flex-col gap-1.5 overflow-y-auto overscroll-contain px-3 py-3" onWheel={(event) => event.stopPropagation()}>
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

                {/* Ask AI (Landing Page Drawer) */}
                <motion.button
                  variants={menuItem}
                  type="button"
                  aria-label="Open AI Style Assistant"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    window.dispatchEvent(new CustomEvent("open-saathi-chat"));
                  }}
                  className="mt-6 group flex items-center gap-4 rounded-3xl border border-primary/15 bg-[#FDF8F1] px-4 py-4 text-left transition hover:border-primary/30 shadow-[0_2px_12px_rgba(120,0,0,0.04)]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F2E8DA] text-primary">
                    <DynamicHugeIcon name="AiChat01Icon" className="h-5 w-5" iconStrokeWidth={1.5} />
                  </span>
                  <span className="block min-w-0">
                    <span className="block text-[1rem] font-semibold text-primary">Ask Saathi AI</span>
                    <span className="mt-0.5 block text-[0.68rem] text-primary/60 leading-tight">Your personal style assistant</span>
                  </span>
                  <DynamicHugeIcon name="ArrowRight01Icon" className="ml-auto h-4 w-4 shrink-0 text-primary/30 transition group-hover:translate-x-0.5" iconStrokeWidth={1.5} />
                </motion.button>

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

        {/* ─── NON-LANDING MOBILE QUICK DRAWER ─── */}
        {isQuickDrawerOpen && !isLandingPage ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ willChange: "opacity" }}
            className="fixed inset-0 z-[120] bg-primary/35 md:hidden"
            onClick={() => setIsQuickDrawerOpen(false)}
          >
            <motion.aside
              initial={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
              }
              style={{ willChange: "transform" }}
              className="ml-auto flex h-full w-[80%] max-w-[340px] flex-col overflow-hidden rounded-l-[2rem] border-l border-primary/15 bg-secondary shadow-[-8px_0_32px_rgba(120,0,0,0.18)]"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-primary/10 px-5 py-4">
                <Link
                  href="/"
                  aria-label="NaariThread — return to homepage"
                  className="group flex items-center gap-2"
                  onClick={() => setIsQuickDrawerOpen(false)}
                >
                  <Image
                    src="/logo4.png"
                    alt="NaariThread logo mark"
                    width={80}
                    height={80}
                    className="h-10 w-10 rounded-full border border-primary/20 object-cover"
                  />
                  <Image
                    src="/logoname2.png"
                    alt="NaariThread logotype"
                    width={128}
                    height={128}
                    className="h-7 w-auto object-contain"
                  />
                </Link>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setIsQuickDrawerOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 text-primary transition hover:border-primary/40"
                >
                  <DynamicHugeIcon name="Cancel01Icon" className="h-4 w-4" iconStrokeWidth={2.2} />
                </button>
              </div>

              {/* Drawer Body */}
              <motion.div
                variants={menuContainer}
                initial="hidden"
                animate="show"
                className="flex flex-1 flex-col gap-3 px-5 py-6"
              >
                {/* Ask AI */}
                <motion.button
                  variants={menuItem}
                  type="button"
                  aria-label="Open AI Style Assistant"
                  onClick={() => {
                    setIsQuickDrawerOpen(false);
                    window.dispatchEvent(new CustomEvent("open-saathi-chat"));
                  }}
                  className="group flex items-center gap-4 rounded-3xl border border-primary/15 bg-[#FDF8F1] px-4 py-5 text-left transition hover:border-primary/30 hover:bg-[#F9F1E6] shadow-[0_2px_12px_rgba(120,0,0,0.04)]"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F2E8DA] text-primary">
                    <DynamicHugeIcon name="AiChat01Icon" className="h-6 w-6" iconStrokeWidth={1.5} />
                  </span>
                  <span className="block min-w-0">
                    <span className="block text-[1.1rem] font-semibold text-primary">Ask AI</span>
                    <span className="mt-0.5 block text-xs text-primary/60 leading-tight">Chat with Saathi, our style assistant</span>
                  </span>
                  <DynamicHugeIcon name="ArrowRight01Icon" className="ml-auto h-5 w-5 shrink-0 text-primary/30 transition group-hover:translate-x-0.5 group-hover:text-primary/70" iconStrokeWidth={1.5} />
                </motion.button>

                {/* Contact Us */}
                <motion.a
                  variants={menuItem}
                  href="tel:+918487849852"
                  aria-label="Call NaariThread support"
                  className="group flex items-center gap-4 rounded-3xl border border-primary/15 bg-[#FDF8F1] px-4 py-5 text-left transition hover:border-primary/30 hover:bg-[#F9F1E6] shadow-[0_2px_12px_rgba(120,0,0,0.04)]"
                  onClick={() => setIsQuickDrawerOpen(false)}
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F2E8DA] text-primary">
                    <DynamicHugeIcon name="CallIcon" className="h-6 w-6" iconStrokeWidth={1.5} />
                  </span>
                  <span className="block min-w-0">
                    <span className="block text-[1.1rem] font-semibold text-primary">Contact Us</span>
                    <span className="mt-0.5 block text-xs text-primary/60 leading-tight">+91 84878 49852</span>
                  </span>
                  <DynamicHugeIcon name="ArrowRight01Icon" className="ml-auto h-5 w-5 shrink-0 text-primary/30 transition group-hover:translate-x-0.5 group-hover:text-primary/70" iconStrokeWidth={1.5} />
                </motion.a>

                {/* WhatsApp */}
                <motion.a
                  variants={menuItem}
                  href="https://wa.me/918487849852?text=Hi%2C+I+have+this+query"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Chat with NaariThread on WhatsApp"
                  className="group flex items-center gap-4 rounded-3xl border border-[#25D366]/20 bg-[#F2FAF5] px-4 py-5 text-left transition hover:border-[#25D366]/40 hover:bg-[#E8F5EE] shadow-[0_2px_12px_rgba(37,211,102,0.06)]"
                  onClick={() => setIsQuickDrawerOpen(false)}
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E1F3E8] text-[#128C35]">
                    <DynamicHugeIcon name="WhatsappIcon" className="h-6 w-6" iconStrokeWidth={1.5} />
                  </span>
                  <span className="block min-w-0">
                    <span className="block text-[1.1rem] font-semibold text-primary">Chat on WhatsApp</span>
                    <span className="mt-0.5 block text-xs text-primary/60 leading-tight">Tap to open a conversation</span>
                  </span>
                  <DynamicHugeIcon name="ArrowRight01Icon" className="ml-auto h-5 w-5 shrink-0 text-primary/30 transition group-hover:translate-x-0.5 group-hover:text-primary/70" iconStrokeWidth={1.5} />
                </motion.a>


              </motion.div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AuthModal
        open={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Sign up / Login"
        description="Use Email OTP to continue to your account, wishlist, and cart sync."
      />
    </>
  );
}
