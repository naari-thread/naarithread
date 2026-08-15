"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { ProductCard } from "@/app/components/product-card";
import { ProductSearchCombobox } from "@/app/components/product-search-combobox";
import { showActionToast } from "@/lib/action-toast";
import type { ProductSearchEntry } from "@/lib/firebase/product-search-index";
import {
  getProductCartLineIds,
  getProductCartQuantity,
  parseCartLineId,
  readCartItems,
  subscribeToCartChanges,
  writeCartItems,
  type CartItemsMap,
} from "@/lib/cart-state";
import type { ProductRecord } from "@/lib/appwrite/products";
import { fetchProductsByIds } from "@/lib/product-catalog-cache";
import {
  compareProductStockPlacement,
  isNewArrival,
  isOnSale,
  matchesColor,
  matchesPriceRange,
  matchesSearch,
  matchesSize,
} from "@/lib/product-filters";
import { rankProductSearchEntries } from "@/lib/product-search";
import {
  PRODUCT_TAXONOMY,
  getCategoryForSubCategory,
  getCategoryLabelBySlug,
  getSubCategoryLabelBySlug,
  isProductCategorySlug,
  isProductSubCategorySlug,
  type ProductCategorySlug,
  type ProductSubCategorySlug,
} from "@/lib/product-taxonomy";
import {
  readWishlistItems,
  subscribeToWishlistChanges,
  toggleWishlistItem,
  type WishlistItemsMap,
} from "@/lib/wishlist-state";

type ProductsCatalogProps = {
  initialProducts: ProductRecord[];
  searchIndex?: ProductSearchEntry[];
  activeCategorySlug: string;
  activeSubCategorySlug: string;
};

const PAGE_SIZE = 24;
const PRICE_ABSOLUTE_MIN = 0;
const PRICE_ABSOLUTE_MAX = 5000;

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function toUniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

function mergeProductsById(
  current: ProductRecord[],
  incoming: ProductRecord[]
): ProductRecord[] {
  const byId = new Map(current.map((product) => [product.id, product]));
  for (const product of incoming) byId.set(product.id, product);
  return [...byId.values()];
}

const COLOR_SWATCH_MAP: Record<string, string> = {
  red: "#C62828",
  maroon: "#7B1D1D",
  black: "#1A1A1A",
  white: "#FFFFFF",
  cream: "#FFF0D6",
  beige: "#F5ECD7",
  navy: "#1A237E",
  blue: "#1565C0",
  green: "#2E7D32",
  pink: "#E91E8C",
  yellow: "#F9A825",
  orange: "#E65100",
  purple: "#6A1B9A",
  grey: "#757575",
  gray: "#757575",
  brown: "#5D4037",
  gold: "#B8860B",
  silver: "#A8A9AD",
  lavender: "#967BB6",
  peach: "#FFCBA4",
  teal: "#00695C",
  mustard: "#E3A020",
};

function getSwatchHex(colorName: string): string {
  const normalized = colorName.trim().toLowerCase();
  if (COLOR_SWATCH_MAP[normalized]) {
    return COLOR_SWATCH_MAP[normalized];
  }

  const keywordMap: Array<{ key: string; hex: string }> = [
    { key: "gold", hex: "#B8860B" },
    { key: "bronze", hex: "#CD7F32" },
    { key: "berry", hex: "#8E3A59" },
    { key: "wine", hex: "#722F37" },
    { key: "beige", hex: "#F5ECD7" },
    { key: "cream", hex: "#FFF0D6" },
    { key: "maroon", hex: "#7B1D1D" },
    { key: "red", hex: "#C62828" },
    { key: "black", hex: "#1A1A1A" },
    { key: "white", hex: "#FFFFFF" },
    { key: "blue", hex: "#1565C0" },
    { key: "green", hex: "#2E7D32" },
    { key: "pink", hex: "#E91E8C" },
    { key: "purple", hex: "#6A1B9A" },
    { key: "gray", hex: "#757575" },
    { key: "grey", hex: "#757575" },
    { key: "brown", hex: "#5D4037" },
  ];

  const match = keywordMap.find((item) => normalized.includes(item.key));
  return match?.hex ?? "#CCCCCC";
}

type SelectDropdownProps = {
  label: string;
  placeholder: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  open: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
  clearable?: boolean;
  onClear?: () => void;
  className?: string;
  wrapperClassName?: string;
  renderOption?: (option: { label: string; value: string }) => ReactNode;
  isActive?: boolean;
  alignRightOnMobile?: boolean;
};

function SelectDropdown({
  label,
  placeholder,
  value,
  options,
  open,
  onToggle,
  onSelect,
  clearable = false,
  onClear,
  className,
  wrapperClassName,
  renderOption,
  isActive = false,
  alignRightOnMobile = false,
}: SelectDropdownProps): ReactElement {
  return (
    <div className={`relative z-60 ${wrapperClassName ?? ""}`}>
      <button
        type="button"
        aria-label={`Open ${label} dropdown`}
        aria-expanded={open}
        onClick={onToggle}
        className={`inline-flex h-9 w-auto cursor-pointer items-center justify-between gap-1.5 rounded-lg border px-2.5 text-[0.98rem] transition sm:text-xs ${
          isActive
            ? "border-primary bg-primary text-secondary"
            : "border-primary/18 bg-secondary text-primary/88 hover:border-primary/35"
        } ${className ?? ""}`}
      >
        <span className="truncate">{value || placeholder}</span>
        <span className="inline-flex items-center gap-1">
          {clearable && value ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${label} selection`}
              onClick={(event) => {
                event.stopPropagation();
                onClear?.();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onClear?.();
                }
              }}
              className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border transition ${
                isActive
                  ? "border-secondary/45 text-secondary"
                  : "border-primary/14 text-primary/66 hover:border-primary/28 hover:text-primary"
              }`}
            >
              <DynamicHugeIcon
                name="Cancel01Icon"
                className="h-3 w-3"
                iconStrokeWidth={2}
                aria-hidden={true}
              />
            </span>
          ) : null}
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute top-[calc(100%+6px)] z-[100] min-w-[190px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-primary/16 bg-secondary shadow-[0_18px_36px_rgba(120,0,0,0.16)] ${
              alignRightOnMobile ? "right-0" : "left-0"
            }`}
          >
            <p className="px-2.5 pb-1 pt-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-primary/48">
              {label}
            </p>
            <button
              type="button"
              onClick={() => onSelect("")}
              className="block w-full cursor-pointer border-b border-primary/8 px-2.5 py-2 text-left text-[0.98rem] text-primary/72 transition hover:bg-primary/[0.05] hover:text-primary sm:text-xs"
            >
              All
            </button>
            <div
              className="max-h-56 overflow-y-auto overscroll-contain"
              onWheel={(event) => event.stopPropagation()}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelect(option.value)}
                  className="block w-full cursor-pointer px-2.5 py-2 text-left text-[0.98rem] text-primary/65 transition hover:bg-primary/[0.05] hover:text-primary sm:text-xs"
                >
                  {renderOption ? renderOption(option) : option.label}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type CategoryAccordionDropdownProps = {
  open: boolean;
  value: string;
  categories: typeof PRODUCT_TAXONOMY;
  expandedCategory: ProductCategorySlug | "";
  onToggle: () => void;
  onToggleCategory: (value: ProductCategorySlug) => void;
  onSelectCategory: (value: ProductCategorySlug | "") => void;
  onSelectSubCategory: (
    category: ProductCategorySlug,
    subCategory: ProductSubCategorySlug,
  ) => void;
  onClear: () => void;
  isActive?: boolean;
};

function CategoryAccordionDropdown({
  open,
  value,
  categories,
  expandedCategory,
  onToggle,
  onToggleCategory,
  onSelectCategory,
  onSelectSubCategory,
  onClear,
  isActive = false,
}: CategoryAccordionDropdownProps): ReactElement {
  return (
    <div className="relative z-60">
      <button
        type="button"
        aria-label="Open Categories dropdown"
        aria-expanded={open}
        onClick={onToggle}
        className={`inline-flex h-9 w-auto cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[0.98rem] transition sm:text-xs ${
          isActive
            ? "border-primary bg-primary text-secondary"
            : "border-primary/18 bg-secondary text-primary/88 hover:border-primary/35"
        }`}
      >
        <span className="truncate">{value || "All Categories"}</span>
        {isActive ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear category selection"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onClear();
              }
            }}
            className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-secondary/45 text-secondary"
          >
            <DynamicHugeIcon name="Cancel01Icon" className="h-3 w-3" />
          </span>
        ) : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-[calc(100%+6px)] z-[100] min-w-[220px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-primary/16 bg-secondary shadow-[0_18px_36px_rgba(120,0,0,0.16)]"
          >
            <p className="px-2.5 pb-1 pt-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-primary/48">
              Categories
            </p>
            <button
              onClick={onClear}
              type="button"
              className="block w-full cursor-pointer border-b border-primary/8 px-2.5 py-2 text-left text-[0.98rem] text-primary/72 transition hover:bg-primary/[0.05] hover:text-primary sm:text-xs"
            >
              All
            </button>
            <div className="max-h-64 overflow-y-auto">
              {categories.map((category) => (
                <div key={category.slug} className="border-b border-primary/8 last:border-b-0">
                  <button
                    type="button"
                    aria-label={`Toggle ${category.label} options`}
                    onClick={() => onToggleCategory(category.slug)}
                    className="flex w-full cursor-pointer items-center justify-between px-2.5 py-2 text-left text-[0.98rem] font-semibold text-primary transition hover:bg-primary/[0.05] sm:text-xs"
                  >
                    <span>{category.label}</span>
                    <span className="text-[10px] text-primary/55">
                      {expandedCategory === category.slug ? "−" : "+"}
                    </span>
                  </button>
                  {expandedCategory === category.slug ? (
                    <div className="border-l-2 border-primary/12 pb-1 pl-2">
                      <button
                        type="button"
                        aria-label={`Show all ${category.label}`}
                        onClick={() => onSelectCategory(category.slug)}
                        className="block w-full cursor-pointer px-2.5 py-1.5 text-left text-[0.98rem] font-normal text-primary/60 transition hover:bg-primary/[0.05] hover:text-primary sm:text-xs"
                      >
                        All {category.label}
                      </button>
                      {category.subCategories.map((subCategory) => (
                        <button
                          key={subCategory.slug}
                          type="button"
                          aria-label={`Filter by ${subCategory.label}`}
                          onClick={() => onSelectSubCategory(category.slug, subCategory.slug)}
                          className="block w-full cursor-pointer px-2.5 py-1.5 text-left text-[0.98rem] font-normal text-primary/60 transition hover:bg-primary/[0.05] hover:text-primary sm:text-xs"
                        >
                          {subCategory.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function ProductsCatalog({
  initialProducts,
  searchIndex = [],
  activeCategorySlug,
  activeSubCategorySlug,
}: ProductsCatalogProps): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const queryParam = searchParams.get("q") ?? "";
  const [searchText, setSearchText] = useState(queryParam);
  const [prevQueryParam, setPrevQueryParam] = useState(queryParam);
  if (prevQueryParam !== queryParam) {
    setPrevQueryParam(queryParam);
    setSearchText(queryParam);
  }

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [loadedProducts, setLoadedProducts] = useState(initialProducts);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isResolvingSearch, setIsResolvingSearch] = useState(false);
  const [cartItems, setCartItems] = useState<CartItemsMap>({});
  const [wishlistItems, setWishlistItems] = useState<WishlistItemsMap>({});

  const [selectedCategory, setSelectedCategory] = useState<ProductCategorySlug | "">(() =>
    isProductCategorySlug(activeCategorySlug) ? activeCategorySlug : ""
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState<ProductSubCategorySlug | "">(() =>
    isProductSubCategorySlug(activeSubCategorySlug) ? activeSubCategorySlug : ""
  );

  const [prevRouteProps, setPrevRouteProps] = useState({ activeCategorySlug, activeSubCategorySlug });
  if (
    prevRouteProps.activeCategorySlug !== activeCategorySlug ||
    prevRouteProps.activeSubCategorySlug !== activeSubCategorySlug
  ) {
    setPrevRouteProps({ activeCategorySlug, activeSubCategorySlug });
    setSelectedCategory(isProductCategorySlug(activeCategorySlug) ? activeCategorySlug : "");
    setSelectedSubCategory(isProductSubCategorySlug(activeSubCategorySlug) ? activeSubCategorySlug : "");
  }

  const [priceMin, setPriceMin] = useState(PRICE_ABSOLUTE_MIN);
  const [priceMax, setPriceMax] = useState(PRICE_ABSOLUTE_MAX);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedPriceRange, setSelectedPriceRange] = useState("");
  const [onlyOnSale, setOnlyOnSale] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filterSignature = `${selectedCategory}|${selectedSubCategory}|${selectedSize}|${selectedColor}|${priceMin}|${priceMax}|${onlyOnSale}|${onlyNew}|${onlyInStock}|${searchQuery}`;
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  if (prevFilterSignature !== filterSignature) {
    setPrevFilterSignature(filterSignature);
    setVisibleCount(PAGE_SIZE);
  }

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<ProductCategorySlug | "">("");

  // Handle browser Back/Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = (): void => {
      const pathname = window.location.pathname;
      const segments = pathname.split("/").filter(Boolean);
      if (segments[0] === "products") {
        const categoryParam = segments[1] && isProductCategorySlug(segments[1]) ? segments[1] : "";
        const subCategoryParam = segments[2] && isProductSubCategorySlug(segments[2]) ? segments[2] : "";
        setSelectedCategory(categoryParam);
        setSelectedSubCategory(subCategoryParam);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

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

  // Debounce free-text search input
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQuery(searchText.trim());
      setIsResolvingSearch(false);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchText]);

  const navigateForFilter = (
    category: ProductCategorySlug | "",
    subCategory: ProductSubCategorySlug | "",
  ): void => {
    const nextPath = subCategory
      ? `/products/${category}/${subCategory}`
      : category
        ? `/products/${category}`
        : "/products";

    if (typeof window === "undefined" || window.location.pathname === nextPath) {
      return;
    }

    window.history.pushState(null, "", nextPath);
  };

  // Derive available sizes and colors directly from cached catalog products
  const availableSizes = useMemo(() => {
    return toUniqueSorted(loadedProducts.flatMap((item) => item.sizeOptions));
  }, [loadedProducts]);

  const availableColors = useMemo(() => {
    return toUniqueSorted(loadedProducts.flatMap((item) => item.colorOptions));
  }, [loadedProducts]);

  const mobileColorOptions = useMemo(() => availableColors.slice(0, 5), [availableColors]);

  const availableCategories = useMemo(() => {
    return PRODUCT_TAXONOMY.map((item) => ({
      label: item.label,
      value: item.slug,
    }));
  }, []);

  const availableSubCategories = useMemo(() => {
    const categories = selectedCategory
      ? PRODUCT_TAXONOMY.filter((item) => item.slug === selectedCategory)
      : PRODUCT_TAXONOMY;

    return categories
      .flatMap((item) => item.subCategories)
      .map((item) => ({ label: item.label, value: item.slug }));
  }, [selectedCategory]);

  const priceOptions = useMemo(
    () => [
      { label: "₹499 - ₹1,499", value: "499-1499" },
      { label: "₹1,500 - ₹2,999", value: "1500-2999" },
      { label: "₹3,000 - ₹5,000", value: "3000-5000" },
    ],
    [],
  );

  // In-memory complete filtering and sorting over the cached catalog
  const filteredProducts = useMemo(() => {
    const seenIds = new Set<string>();
    const matched: ProductRecord[] = [];

    for (const product of loadedProducts) {
      if (seenIds.has(product.id)) {
        continue;
      }
      seenIds.add(product.id);

      if (product.isActive === false) {
        continue;
      }

      if (selectedCategory && product.category !== selectedCategory) {
        continue;
      }

      if (selectedSubCategory && product.subCategory !== selectedSubCategory) {
        continue;
      }

      if (selectedSize && !matchesSize(product, selectedSize)) {
        continue;
      }

      if (selectedColor && !matchesColor(product, selectedColor)) {
        continue;
      }

      if (onlyOnSale && !isOnSale(product)) {
        continue;
      }

      if (onlyNew && !isNewArrival(product)) {
        continue;
      }

      if (onlyInStock && product.stockQty <= 0) {
        continue;
      }

      if (
        (priceMin > PRICE_ABSOLUTE_MIN || priceMax < PRICE_ABSOLUTE_MAX) &&
        !matchesPriceRange(product, priceMin, priceMax)
      ) {
        continue;
      }

      if (searchQuery && !matchesSearch(product, searchQuery)) {
        continue;
      }

      matched.push(product);
    }

    return matched.sort((a, b) => {
      const stockCompare = compareProductStockPlacement(a, b);
      if (stockCompare !== 0) {
        return stockCompare;
      }
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [
    loadedProducts,
    selectedCategory,
    selectedSubCategory,
    selectedSize,
    selectedColor,
    priceMin,
    priceMax,
    onlyOnSale,
    onlyNew,
    onlyInStock,
    searchQuery,
  ]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  const scopeEntries = useMemo(
    () => searchIndex.filter((entry) =>
      (!selectedCategory || entry.category === selectedCategory)
      && (!selectedSubCategory || entry.subCategory === selectedSubCategory)
    ),
    [searchIndex, selectedCategory, selectedSubCategory]
  );
  const matchingSearchEntries = useMemo(
    () => searchQuery
      ? rankProductSearchEntries(scopeEntries, searchQuery)
      : scopeEntries,
    [scopeEntries, searchQuery]
  );
  const loadedProductIds = useMemo(
    () => new Set(loadedProducts.map((product) => product.id)),
    [loadedProducts]
  );
  const targetEntries = searchQuery ? matchingSearchEntries : scopeEntries;
  const missingTargetIds = useMemo(
    () => targetEntries
      .filter((entry) => !loadedProductIds.has(entry.id))
      .map((entry) => entry.id),
    [loadedProductIds, targetEntries]
  );
  const hasServerMore = missingTargetIds.length > 0;
  const hasMore = visibleCount < filteredProducts.length || hasServerMore;

  useEffect(() => {
    const missingFirstPageIds = matchingSearchEntries
      .slice(0, PAGE_SIZE)
      .filter((entry) => !loadedProductIds.has(entry.id))
      .map((entry) => entry.id);
    const controller = new AbortController();
    const kickoff = window.setTimeout(() => {
      if (
        searchQuery.trim().length < 2
        || searchIndex.length === 0
        || missingFirstPageIds.length === 0
      ) {
        setIsResolvingSearch(false);
        return;
      }

      setIsResolvingSearch(true);
      void fetchProductsByIds(missingFirstPageIds, controller.signal)
        .then((products) => {
          if (controller.signal.aborted) return;
          if (products.length > 0) {
            setLoadedProducts((current) => mergeProductsById(current, products));
          }
          setIsResolvingSearch(false);
        });
    }, 0);

    return () => {
      window.clearTimeout(kickoff);
      controller.abort();
    };
  }, [loadedProductIds, matchingSearchEntries, searchIndex.length, searchQuery]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (visibleCount < filteredProducts.length) {
      setVisibleCount((previous) => previous + PAGE_SIZE);
      return;
    }
    if (!hasServerMore || isLoadingMore) return;

    setIsLoadingMore(true);
    const products = await fetchProductsByIds(missingTargetIds.slice(0, PAGE_SIZE));
    if (products.length > 0) {
      setLoadedProducts((current) => mergeProductsById(current, products));
      setVisibleCount((previous) => previous + PAGE_SIZE);
    }
    setIsLoadingMore(false);
  }, [filteredProducts.length, hasServerMore, isLoadingMore, missingTargetIds, visibleCount]);

  const activeFilterCount = [
    selectedCategory,
    selectedSubCategory,
    selectedSize,
    selectedColor,
    onlyOnSale ? "on-sale" : "",
    onlyNew ? "new" : "",
    onlyInStock ? "in-stock" : "",
    selectedPriceRange || priceMin > PRICE_ABSOLUTE_MIN || priceMax < PRICE_ABSOLUTE_MAX ? "price" : "",
  ].filter(Boolean).length;

  const updateCartQuantity = (lineId: string, quantity: number): void => {
    const nextQuantity = Math.min(99, Math.max(0, Math.trunc(quantity)));
    const identity = parseCartLineId(lineId);
    const product = loadedProducts.find((item) => item.id === identity.productId);
    const availableStock = product?.sizeInventory.length
      ? product.sizeInventory.find((item) => item.size === identity.size)?.stockQty ?? 0
      : product?.stockQty ?? 0;
    const previousQuantity = readCartItems()[lineId] ?? 0;

    if (nextQuantity > availableStock) {
      showActionToast({
        id: `cart-stock-limit-${lineId}`,
        message: "Stock limit reached",
        description: `Only ${availableStock} available${identity.size ? ` in size ${identity.size}` : ""}.`,
        tone: "error",
      });
      return;
    }

    const nextItems: CartItemsMap = { ...readCartItems() };
    if (nextQuantity <= 0) {
      delete nextItems[lineId];
    } else {
      nextItems[lineId] = nextQuantity;
    }

    setCartItems(nextItems);
    writeCartItems(nextItems);

    const productName = product?.name ?? "Item";
    if (previousQuantity <= 0 && nextQuantity > 0) {
      showActionToast({
        id: `cart-added-${lineId}`,
        message: "Added to cart",
        description: productName,
      });
    } else if (previousQuantity > 0 && nextQuantity <= 0) {
      showActionToast({
        id: `cart-removed-${lineId}`,
        message: "Removed from cart",
        description: productName,
        tone: "info",
      });
    }
  };

  const toggleProductWishlist = (productId: string): void => {
    const wasAdded = toggleWishlistItem(productId);
    const productName = loadedProducts.find((product) => product.id === productId)?.name ?? "Item";
    showActionToast({
      id: `wishlist-${wasAdded ? "added" : "removed"}-${productId}`,
      message: wasAdded ? "Saved to wishlist" : "Removed from wishlist",
      description: productName,
      tone: wasAdded ? "success" : "info",
    });
  };

  return (
    <>
      <section className="mx-auto w-full max-w-7xl">
        <div className="mb-3 hidden items-end justify-between gap-3 sm:flex">
          <div className="mb-1 sm:mb-0">
            <h1 className="mt-1 font-display text-2xl leading-tight sm:text-4xl">
              Shop The Collection
            </h1>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60">
            {filteredProducts.length} item{filteredProducts.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="relative z-40 flex flex-col gap-3 border-b border-primary/12 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[220px] sm:flex-1">
            <button
              onClick={() => router.back()}
              type="button"
              aria-label="Go back"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-primary/12 bg-secondary text-primary sm:hidden"
            >
              <DynamicHugeIcon name="ArrowLeft01Icon" className="h-5 w-5" />
            </button>
            <ProductSearchCombobox
              products={searchIndex.length > 0
                ? searchIndex
                : loadedProducts.map((product) => ({
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    category: product.category,
                    subCategory: product.subCategory,
                  }))}
              value={searchText}
              onValueChange={(value) => {
                setSearchText(value);
                setIsResolvingSearch(false);
              }}
              onProductSelect={(product) => {
                setSearchQuery(product.name);
                router.push(
                  `/products/${product.category}/${product.subCategory}/${product.slug}`
                );
              }}
            />
          </div>

          <div className="relative z-50 flex w-full flex-wrap items-center gap-2 pb-1 sm:w-auto sm:flex-none sm:gap-3 sm:pb-0">
            <CategoryAccordionDropdown
              value={
                selectedSubCategory
                  ? getSubCategoryLabelBySlug(selectedSubCategory)
                  : selectedCategory
                    ? getCategoryLabelBySlug(selectedCategory)
                    : ""
              }
              categories={PRODUCT_TAXONOMY}
              expandedCategory={expandedCategory}
              isActive={Boolean(selectedCategory || selectedSubCategory)}
              open={categoryOpen}
              onToggle={() => {
                setCategoryOpen((prev) => !prev);
                setPriceOpen(false);
                setSizeOpen(false);
                setColorOpen(false);
                setFilterOpen(false);
              }}
              onToggleCategory={(value) => {
                setExpandedCategory((previous) => (previous === value ? "" : value));
              }}
              onSelectCategory={(value) => {
                setSelectedCategory(value);
                setSelectedSubCategory("");
                navigateForFilter(value, "");
                setCategoryOpen(false);
              }}
              onSelectSubCategory={(category, subCategory) => {
                setSelectedCategory(category);
                setSelectedSubCategory(subCategory);
                navigateForFilter(category, subCategory);
                setCategoryOpen(false);
              }}
              onClear={() => {
                setSelectedCategory("");
                setSelectedSubCategory("");
                navigateForFilter("", "");
                setCategoryOpen(false);
              }}
            />

            <SelectDropdown
              label="Price"
              placeholder="Price"
              value={
                selectedPriceRange
                  ? (priceOptions.find((item) => item.value === selectedPriceRange)?.label ?? "")
                  : ""
              }
              options={priceOptions}
              clearable={true}
              className="w-auto"
              isActive={Boolean(selectedPriceRange)}
              open={priceOpen}
              onToggle={() => {
                setPriceOpen((prev) => !prev);
                setCategoryOpen(false);
                setSizeOpen(false);
                setColorOpen(false);
                setFilterOpen(false);
              }}
              onSelect={(value) => {
                setSelectedPriceRange(value);
                if (value) {
                  const [nextMinRaw, nextMaxRaw] = value.split("-");
                  const nextMin = Number(nextMinRaw);
                  const nextMax = Number(nextMaxRaw);
                  if (Number.isFinite(nextMin) && Number.isFinite(nextMax)) {
                    setPriceMin(nextMin);
                    setPriceMax(nextMax);
                  }
                } else {
                  setPriceMin(PRICE_ABSOLUTE_MIN);
                  setPriceMax(PRICE_ABSOLUTE_MAX);
                }
                setPriceOpen(false);
              }}
              onClear={() => {
                setSelectedPriceRange("");
                setPriceMin(PRICE_ABSOLUTE_MIN);
                setPriceMax(PRICE_ABSOLUTE_MAX);
                setPriceOpen(false);
              }}
            />

            <SelectDropdown
              label="Size"
              placeholder="Size"
              value={selectedSize}
              options={availableSizes.map((item) => ({ label: item, value: item }))}
              clearable={true}
              className="w-auto"
              isActive={Boolean(selectedSize)}
              open={sizeOpen}
              onToggle={() => {
                setSizeOpen((prev) => !prev);
                setCategoryOpen(false);
                setPriceOpen(false);
                setColorOpen(false);
                setFilterOpen(false);
              }}
              onSelect={(value) => {
                setSelectedSize(value);
                setSizeOpen(false);
              }}
              onClear={() => {
                setSelectedSize("");
                setSizeOpen(false);
              }}
            />

            <SelectDropdown
              label="Color"
              placeholder="Color"
              value={selectedColor}
              options={mobileColorOptions.map((item) => ({
                label: item,
                value: item,
              }))}
              clearable={true}
              className="w-auto"
              isActive={Boolean(selectedColor)}
              alignRightOnMobile={true}
              open={colorOpen}
              onToggle={() => {
                setColorOpen((prev) => !prev);
                setCategoryOpen(false);
                setPriceOpen(false);
                setSizeOpen(false);
                setFilterOpen(false);
              }}
              onSelect={(value) => {
                setSelectedColor(value);
                setColorOpen(false);
              }}
              onClear={() => {
                setSelectedColor("");
                setColorOpen(false);
              }}
              renderOption={(option) => (
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden={true}
                    className="h-3.5 w-3.5 rounded-full border border-primary/20"
                    style={{ backgroundColor: getSwatchHex(option.value) }}
                  />
                  <span>{option.label}</span>
                </span>
              )}
            />
          </div>

          <div className="relative hidden">
            <button
              type="button"
              aria-label="Open product filters"
              aria-expanded={filterOpen}
              onClick={() => {
                setFilterOpen((prev) => !prev);
                setCategoryOpen(false);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-secondary text-primary transition hover:border-primary/35"
            >
              <DynamicHugeIcon
                name="FilterHorizontalIcon"
                className="h-4.5 w-4.5"
                iconStrokeWidth={1.9}
                aria-hidden={true}
              />
              {activeFilterCount > 0 ? (
                <span
                  className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.62rem] font-semibold leading-none text-secondary"
                  aria-label={`${activeFilterCount} active filters`}
                >
                  {activeFilterCount > 9 ? "9+" : activeFilterCount}
                </span>
              ) : null}
            </button>

            <AnimatePresence>
              {filterOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute right-0 top-[calc(100%+8px)] z-20 w-[300px] max-h-[72vh] overflow-y-auto overscroll-contain rounded-xl border border-primary/16 bg-secondary p-3 shadow-[0_18px_36px_rgba(120,0,0,0.16)]"
                  onWheel={(event) => event.stopPropagation()}
                >
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-primary/62">
                    Advanced Filters
                  </p>

                  <div className="mt-3 space-y-2.5">
                    <div className="block sm:hidden">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">
                        Category
                      </p>
                      <select
                        aria-label="Filter by category"
                        value={selectedCategory}
                        onChange={(event) => {
                          const nextCategory = event.target.value;
                          if (isProductCategorySlug(nextCategory)) {
                            setSelectedCategory(nextCategory);
                            navigateForFilter(nextCategory, "");
                          } else {
                            setSelectedCategory("");
                            navigateForFilter("", "");
                          }
                          setSelectedSubCategory("");
                        }}
                        className="h-10 w-full rounded-lg border border-primary/16 bg-paper px-2.5 text-sm text-primary outline-none"
                      >
                        <option value="">All Categories</option>
                        {availableCategories.map((category) => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="block sm:hidden">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">
                        Subcategory
                      </p>
                      <select
                        aria-label="Filter by subcategory"
                        value={selectedSubCategory}
                        onChange={(event) => {
                          const nextSubCategory = event.target.value;
                          if (!nextSubCategory) {
                            setSelectedSubCategory("");
                            navigateForFilter(selectedCategory, "");
                            return;
                          }

                          if (!isProductSubCategorySlug(nextSubCategory)) {
                            return;
                          }

                          const nextCategory = selectedCategory || getCategoryForSubCategory(nextSubCategory);
                          setSelectedCategory(nextCategory);
                          setSelectedSubCategory(nextSubCategory);
                          navigateForFilter(nextCategory, nextSubCategory);
                        }}
                        className="h-10 w-full rounded-lg border border-primary/16 bg-paper px-2.5 text-sm text-primary outline-none"
                      >
                        <option value="">All Subcategories</option>
                        {availableSubCategories.map((subcat) => (
                          <option key={subcat.value} value={subcat.value}>
                            {subcat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Price Range */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">
                          Price Range
                        </p>
                        <p className="text-[0.68rem] font-semibold text-primary/80">
                          ₹{priceMin.toLocaleString("en-IN")} – ₹{priceMax.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="relative flex h-5 items-center">
                        <div className="absolute inset-x-0 h-1 rounded-full bg-primary/12" />
                        <div
                          className="absolute h-1 rounded-full bg-primary/70"
                          style={{
                            left: `${((priceMin - PRICE_ABSOLUTE_MIN) / (PRICE_ABSOLUTE_MAX - PRICE_ABSOLUTE_MIN)) * 100}%`,
                            right: `${((PRICE_ABSOLUTE_MAX - priceMax) / (PRICE_ABSOLUTE_MAX - PRICE_ABSOLUTE_MIN)) * 100}%`,
                          }}
                        />
                        <input
                          type="range"
                          min={PRICE_ABSOLUTE_MIN}
                          max={PRICE_ABSOLUTE_MAX}
                          step={100}
                          value={priceMin}
                          onChange={(e) => {
                            const val = Math.min(Number(e.target.value), priceMax - 100);
                            setPriceMin(val);
                          }}
                          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-secondary [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-secondary [&::-webkit-slider-thumb]:shadow-[0_1px_6px_rgba(120,0,0,0.22)]"
                          style={{
                            zIndex: priceMin > PRICE_ABSOLUTE_MAX - 200 ? 5 : 3,
                          }}
                        />
                        <input
                          type="range"
                          min={PRICE_ABSOLUTE_MIN}
                          max={PRICE_ABSOLUTE_MAX}
                          step={100}
                          value={priceMax}
                          onChange={(e) => {
                            const val = Math.max(Number(e.target.value), priceMin + 100);
                            setPriceMax(val);
                          }}
                          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-secondary [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-secondary [&::-webkit-slider-thumb]:shadow-[0_1px_6px_rgba(120,0,0,0.22)]"
                          style={{ zIndex: 4 }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[0.6rem] text-primary/45">
                        <span>₹{PRICE_ABSOLUTE_MIN.toLocaleString("en-IN")}</span>
                        <span>₹{PRICE_ABSOLUTE_MAX.toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">
                        Size
                      </p>
                      <select
                        aria-label="Filter by size"
                        value={selectedSize}
                        onChange={(event) => setSelectedSize(event.target.value)}
                        className="h-10 w-full rounded-lg border border-primary/16 bg-paper px-2.5 text-sm text-primary outline-none"
                      >
                        <option value="">All sizes</option>
                        {availableSizes.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>

                    {availableColors.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">
                          Color
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {availableColors.map((color) => {
                            const hex = getSwatchHex(color);
                            const isSelected = normalizeValue(selectedColor) === normalizeValue(color);
                            const isLight = [
                              "white",
                              "cream",
                              "beige",
                              "silver",
                              "lavender",
                              "peach",
                            ].includes(color.trim().toLowerCase());
                            return (
                              <button
                                key={color}
                                type="button"
                                aria-label={`Filter by color ${color}`}
                                aria-pressed={isSelected}
                                title={color}
                                onClick={() => setSelectedColor(isSelected ? "" : color)}
                                className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${
                                  isSelected
                                    ? "border-primary shadow-[0_0_0_2px_rgba(120,0,0,0.22)]"
                                    : isLight
                                      ? "border-primary/20 hover:border-primary/50"
                                      : "border-transparent hover:border-primary/40"
                                }`}
                                style={{ backgroundColor: hex }}
                              >
                                {isSelected && (
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{
                                      backgroundColor: isLight ? "#1A1A1A" : "#FFFFFF",
                                    }}
                                  />
                                )}
                              </button>
                            );
                          })}
                          {selectedColor && (
                            <button
                              type="button"
                              aria-label="Clear color filter"
                              onClick={() => setSelectedColor("")}
                              className="flex h-7 items-center gap-1 rounded-full border border-primary/20 px-2 text-[0.6rem] font-semibold uppercase tracking-wide text-primary/65 hover:border-primary/40"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-sm text-primary/86">
                      <input
                        type="checkbox"
                        checked={onlyOnSale}
                        onChange={(event) => setOnlyOnSale(event.target.checked)}
                      />
                      On Sale
                    </label>
                    <label className="flex items-center gap-2 text-sm text-primary/86">
                      <input
                        type="checkbox"
                        checked={onlyNew}
                        onChange={(event) => setOnlyNew(event.target.checked)}
                      />
                      New Arrivals
                    </label>
                    <label className="flex items-center gap-2 text-sm text-primary/86">
                      <input
                        type="checkbox"
                        checked={onlyInStock}
                        onChange={(event) => setOnlyInStock(event.target.checked)}
                      />
                      In Stock Only
                    </label>

                    <button
                      type="button"
                      aria-label="Reset product filters"
                      onClick={() => {
                        setSelectedSize("");
                        setSelectedColor("");
                        setOnlyOnSale(false);
                        setOnlyNew(false);
                        setOnlyInStock(false);
                        setPriceMin(PRICE_ABSOLUTE_MIN);
                        setPriceMax(PRICE_ABSOLUTE_MAX);
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-primary/18 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition hover:border-primary/35"
                    >
                      Clear Filters
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 w-full max-w-7xl">
        {filteredProducts.length === 0 && isResolvingSearch ? (
          <div className="rounded-3xl border border-primary/15 bg-secondary/90 p-7 text-center text-primary shadow-[0_12px_30px_rgba(120,0,0,0.08)] sm:p-10" role="status" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary/65">Searching collection</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Finding the best matches…</h2>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-primary/15 bg-secondary/90 p-7 text-center text-primary shadow-[0_12px_30px_rgba(120,0,0,0.08)] sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary/65">
              No products found
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Try another search or filter
            </h2>
            <p className="mt-3 text-sm text-primary/75 sm:text-base">
              No matching products were found with the selected criteria.
            </p>
            {activeFilterCount > 0 ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/62">
                {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"} may be refining results
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <LayoutGroup id="catalog-products">
              <motion.div
                layout={prefersReducedMotion ? false : "position"}
                className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {visibleProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      layout={prefersReducedMotion ? false : "position"}
                      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
                      transition={{
                        layout: { duration: 0.38, ease: "easeInOut" },
                        opacity: { duration: 0.18 },
                        scale: { duration: 0.24 },
                        y: { duration: 0.24 },
                      }}
                      className="h-full"
                    >
                      <ProductCard
                        product={product}
                        quantity={getProductCartQuantity(cartItems, product.id)}
                        onAddToCart={(lineId) => updateCartQuantity(lineId, 1)}
                        onIncreaseQuantity={(productId) => {
                          const lineId = getProductCartLineIds(cartItems, productId)[0];
                          if (lineId) updateCartQuantity(lineId, (cartItems[lineId] ?? 0) + 1);
                        }}
                        onDecreaseQuantity={(productId) => {
                          const lineId = getProductCartLineIds(cartItems, productId)[0];
                          if (lineId) updateCartQuantity(lineId, (cartItems[lineId] ?? 0) - 1);
                        }}
                        isWishlisted={Boolean(wishlistItems[product.id])}
                        onToggleWishlist={toggleProductWishlist}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>

            {hasMore ? (
              <div className="mt-8 flex items-center justify-center py-4">
                <button
                  type="button"
                  aria-label="Load more products"
                  onClick={loadMore}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary/20 bg-secondary px-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary transition hover:border-primary/40 hover:bg-primary hover:text-secondary"
                >
                  {isLoadingMore ? "Loading products…" : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
