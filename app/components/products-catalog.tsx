"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { ProductCard } from "@/app/components/product-card";
import {
  readCartItems,
  subscribeToCartChanges,
  writeCartItems,
  type CartItemsMap,
} from "@/lib/cart-state";
import type { ProductRecord } from "@/lib/appwrite/products";
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

type CatalogFilterPayload = {
  sizes: string[];
  colors: string[];
};

type ProductsCatalogProps = {
  products: ProductRecord[];
  activeCategorySlug: string;
  activeSubCategorySlug: string;
};

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function isOnSale(product: ProductRecord) {
  return (
    product.originalPrice > 0 &&
    product.discountPrice > 0 &&
    product.discountPrice < product.originalPrice
  );
}

function isNewArrival(product: ProductRecord) {
  if (!product.createdAt) {
    return false;
  }

  const createdAtMs = new Date(product.createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  const ageMs = Date.now() - createdAtMs;
  return ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 24 * 30;
}

const PRICE_ABSOLUTE_MIN = 499;
const PRICE_ABSOLUTE_MAX = 5000;

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

function toUniqueSorted(values: string[]) {
  return Array.from(
    new Set(values.map((item) => item.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
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
}: SelectDropdownProps) {
  return (
    <div className={`relative z-60 ${wrapperClassName ?? ""}`}>
      <button
        type="button"
        aria-label={`Open ${label} dropdown`}
        aria-expanded={open}
        onClick={onToggle}
        className={`inline-flex h-9 w-auto items-center justify-between gap-1.5 rounded-lg border px-2.5 text-[0.98rem] transition sm:text-xs ${
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
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${
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
              alignRightOnMobile ? "right-0 sm:left-0 sm:right-auto" : "left-0"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect("")}
                className="block w-full border-b border-primary/8 px-2.5 py-2 text-left text-[0.98rem] text-primary/72 transition hover:bg-primary/[0.05] hover:text-primary sm:text-xs"
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
                    className="block w-full px-2.5 py-2 text-left text-[0.98rem] text-primary/82 transition hover:bg-primary/[0.05] hover:text-primary sm:text-xs"
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
}: CategoryAccordionDropdownProps) {
  return (
    <div className="relative z-60">
      <button
        type="button"
        aria-label="Open Categories dropdown"
        aria-expanded={open}
        onClick={onToggle}
        className={`inline-flex h-9 w-auto items-center gap-1.5 rounded-lg border px-2.5 text-[0.98rem] transition sm:text-xs ${
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
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-secondary/45 text-secondary"
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
            <button onClick={onClear} type="button" className="block w-full border-b border-primary/8 px-2.5 py-2 text-left text-[0.98rem] text-primary/72 hover:bg-primary/[0.05] sm:text-xs">All</button>
            <div className="max-h-64 overflow-y-auto">
              {categories.map((category) => (
                <div key={category.slug} className="border-b border-primary/8 last:border-b-0">
                  <button type="button" aria-label={`Toggle ${category.label} options`} onClick={() => onToggleCategory(category.slug)} className="flex w-full items-center justify-between px-2.5 py-2 text-left text-[0.98rem] text-primary/85 hover:bg-primary/[0.04] sm:text-xs">
                    <span>{category.label}</span>
                    <span className="text-[10px]">{expandedCategory === category.slug ? "−" : "+"}</span>
                  </button>
                  {expandedCategory === category.slug ? (
                    <div className="pb-1">
                      <button type="button" aria-label={`Show all ${category.label}`} onClick={() => onSelectCategory(category.slug)} className="block w-full px-4 py-1.5 text-left text-[0.98rem] text-primary/75 hover:bg-primary/[0.04] sm:text-xs">All {category.label}</button>
                      {category.subCategories.map((subCategory) => (
                        <button key={subCategory.slug} type="button" aria-label={`Filter by ${subCategory.label}`} onClick={() => onSelectSubCategory(category.slug, subCategory.slug)} className="block w-full px-4 py-1.5 text-left text-[0.98rem] text-primary/75 hover:bg-primary/[0.04] sm:text-xs">
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
  products,
  activeCategorySlug,
  activeSubCategorySlug,
}: ProductsCatalogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchText, setSearchText] = useState("");
  const [cartItems, setCartItems] = useState<CartItemsMap>({});
  const [wishlistItems, setWishlistItems] = useState<WishlistItemsMap>({});
  const [filterPayload, setFilterPayload] = useState<CatalogFilterPayload>({
    sizes: [],
    colors: [],
  });
  const [selectedCategory, setSelectedCategory] = useState<
    ProductCategorySlug | ""
  >("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<
    ProductSubCategorySlug | ""
  >("");
  useEffect(() => {
    setSelectedCategory(
      isProductCategorySlug(activeCategorySlug) ? activeCategorySlug : "",
    );
    setSelectedSubCategory(
      isProductSubCategorySlug(activeSubCategorySlug)
        ? activeSubCategorySlug
        : "",
    );
  }, [activeCategorySlug, activeSubCategorySlug]);

  const [priceMin, setPriceMin] = useState(PRICE_ABSOLUTE_MIN);
  const [priceMax, setPriceMax] = useState(PRICE_ABSOLUTE_MAX);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedPriceRange, setSelectedPriceRange] = useState("");
  const [onlyOnSale, setOnlyOnSale] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [subCategoryOpen, setSubCategoryOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<ProductCategorySlug | "">("");

  useEffect(() => {
    setCartItems(readCartItems());
    return subscribeToCartChanges((items) => setCartItems(items));
  }, []);

  useEffect(() => {
    setWishlistItems(readWishlistItems());
    return subscribeToWishlistChanges((items) => setWishlistItems(items));
  }, []);

  useEffect(() => {
    setSearchText(searchParams.get("q") ?? "");
  }, [searchParams]);

  const navigateForFilter = (
    category: ProductCategorySlug | "",
    subCategory: ProductSubCategorySlug | "",
  ) => {
    const nextPath = subCategory
      ? `/products/${category}/${subCategory}`
      : category
        ? `/products/${category}`
        : "/products";
    if (pathname !== nextPath) {
      router.push(nextPath);
    }
  };

  useEffect(() => {
    let alive = true;

    async function loadFilterPayload() {
      try {
        const response = await fetch("/api/catalog/filters", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch filter metadata");
        }

        const payload = (await response.json()) as CatalogFilterPayload;
        if (!alive) {
          return;
        }

        setFilterPayload({
          sizes: Array.isArray(payload.sizes) ? payload.sizes : [],
          colors: Array.isArray(payload.colors) ? payload.colors : [],
        });
      } catch {
        if (!alive) {
          return;
        }

        setFilterPayload({
          sizes: toUniqueSorted(products.flatMap((item) => item.sizeOptions)),
          colors: toUniqueSorted(products.flatMap((item) => item.colorOptions)),
        });
      }
    }

    void loadFilterPayload();
    return () => {
      alive = false;
    };
  }, [products]);

  const updateCartQuantity = (productId: string, quantity: number) => {
    const nextQuantity = Math.min(99, Math.max(0, Math.trunc(quantity)));

    // Compute next state from localStorage (source of truth) so the side
    // effect (writeCartItems) can run outside the state updater — calling
    // setState of another component (Navbar) inside a state updater triggers
    // a React render-phase setState warning.
    const nextItems: CartItemsMap = { ...readCartItems() };
    if (nextQuantity <= 0) {
      delete nextItems[productId];
    } else {
      nextItems[productId] = nextQuantity;
    }

    setCartItems(nextItems);
    writeCartItems(nextItems);
  };

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
  const availableSizes = useMemo(() => {
    return toUniqueSorted([
      ...filterPayload.sizes,
      ...products.flatMap((item) => item.sizeOptions),
    ]);
  }, [filterPayload.sizes, products]);

  const availableColors = useMemo(() => {
    return toUniqueSorted([
      ...filterPayload.colors,
      ...products.flatMap((item) => item.colorOptions),
    ]);
  }, [filterPayload.colors, products]);
  const mobileColorOptions = useMemo(
    () => availableColors.slice(0, 5),
    [availableColors],
  );

  const priceOptions = useMemo(
    () => [
      { label: "₹499 - ₹1,499", value: "499-1499" },
      { label: "₹1,500 - ₹2,999", value: "1500-2999" },
      { label: "₹3,000 - ₹5,000", value: "3000-5000" },
    ],
    [],
  );

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    const exists = availableCategories.some(
      (item) => item.value === selectedCategory,
    );
    if (!exists) {
      setSelectedCategory("");
      setSelectedSubCategory("");
    }
  }, [availableCategories, selectedCategory]);

  useEffect(() => {
    if (!selectedSubCategory) {
      return;
    }

    const exists = availableSubCategories.some(
      (item) => item.value === selectedSubCategory,
    );
    if (!exists) {
      setSelectedSubCategory("");
    }
  }, [availableSubCategories, selectedSubCategory]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return products.filter((product) => {
      if (selectedCategory && product.category !== selectedCategory) {
        return false;
      }

      if (selectedSubCategory && product.subCategory !== selectedSubCategory) {
        return false;
      }

      if (
        selectedSize &&
        !product.sizeOptions.some(
          (size) => normalizeValue(size) === normalizeValue(selectedSize),
        )
      ) {
        return false;
      }

      if (
        selectedColor &&
        !product.colorOptions.some(
          (color) => normalizeValue(color) === normalizeValue(selectedColor),
        )
      ) {
        return false;
      }

      if (onlyOnSale && !isOnSale(product)) {
        return false;
      }

      if (onlyNew && !isNewArrival(product)) {
        return false;
      }

      if (onlyInStock && product.stockQty <= 0) {
        return false;
      }

      const sellingPrice =
        product.discountPrice > 0
          ? product.discountPrice
          : product.originalPrice;
      if (sellingPrice < priceMin || sellingPrice > priceMax) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.sku.toLowerCase().includes(normalizedSearch) ||
        product.categoryValue.toLowerCase().includes(normalizedSearch) ||
        product.subCategoryValue.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [
    products,
    searchText,
    selectedCategory,
    selectedSubCategory,
    selectedSize,
    selectedColor,
    onlyOnSale,
    onlyNew,
    onlyInStock,
    priceMin,
    priceMax,
  ]);

  const activeFilterCount = [
    selectedCategory,
    selectedSubCategory,
    selectedSize,
    selectedColor,
    onlyOnSale ? "on-sale" : "",
    onlyNew ? "new" : "",
    onlyInStock ? "in-stock" : "",
    priceMin > PRICE_ABSOLUTE_MIN || priceMax < PRICE_ABSOLUTE_MAX
      ? "price"
      : "",
  ].filter(Boolean).length;

  const toggleProductWishlist = (productId: string) => {
    toggleWishlistItem(productId);
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
            {filteredProducts.length} item
            {filteredProducts.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="relative z-40 flex flex-col gap-3 border-b border-primary/12 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[220px] sm:flex-1">
            <button
              onClick={() => router.back()}
              type="button"
              aria-label="Go back"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/12 bg-secondary text-primary sm:hidden"
            >
              <DynamicHugeIcon name="ArrowLeft01Icon" className="h-5 w-5" />
            </button>
            <label
              htmlFor="products-search"
              className="group flex h-11 w-full items-center gap-2.5 rounded-xl border border-primary/12 bg-secondary px-3.5 sm:w-auto sm:flex-1"
            >
              <DynamicHugeIcon
                name="Search01Icon"
                className="h-4.5 w-4.5 shrink-0 text-primary/68"
                iconStrokeWidth={1.9}
                aria-hidden={true}
              />
              <input
                id="products-search"
                type="search"
                aria-label="Search for any product"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search by name, category, or subcategory"
                className="w-full bg-transparent text-[0.98rem] text-primary placeholder:text-primary/62 outline-none"
              />
            </label>
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
                setSubCategoryOpen(false);
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
              label="Subcategories"
              placeholder="All Subcategories"
              value={
                selectedSubCategory
                  ? getSubCategoryLabelBySlug(selectedSubCategory)
                  : ""
              }
              options={availableSubCategories}
              clearable={true}
              wrapperClassName="hidden lg:block"
              open={subCategoryOpen}
              onToggle={() => {
                setSubCategoryOpen((prev) => !prev);
                setCategoryOpen(false);
                setPriceOpen(false);
                setSizeOpen(false);
                setColorOpen(false);
                setFilterOpen(false);
              }}
              onSelect={(value) => {
                if (!isProductSubCategorySlug(value)) {
                  setSelectedSubCategory("");
                  navigateForFilter(selectedCategory, "");
                  setSubCategoryOpen(false);
                  return;
                }

                const nextCategory =
                  selectedCategory || getCategoryForSubCategory(value);
                setSelectedCategory(nextCategory);
                setSelectedSubCategory(value);
                navigateForFilter(nextCategory, value);
                setSubCategoryOpen(false);
              }}
              onClear={() => {
                setSelectedSubCategory("");
                navigateForFilter(selectedCategory, "");
                setSubCategoryOpen(false);
              }}
            />

            <SelectDropdown
              label="Price"
              placeholder="Price"
              value={
                selectedPriceRange
                  ? (priceOptions.find((item) => item.value === selectedPriceRange)
                      ?.label ?? "")
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
                setSubCategoryOpen(false);
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
                setSubCategoryOpen(false);
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
                setSubCategoryOpen(false);
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
                setSubCategoryOpen(false);
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

                          const nextCategory =
                            selectedCategory ||
                            getCategoryForSubCategory(nextSubCategory);
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
                          ₹{priceMin.toLocaleString("en-IN")} – ₹
                          {priceMax.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="relative h-5 flex items-center">
                        {/* Track background */}
                        <div className="absolute inset-x-0 h-1 rounded-full bg-primary/12" />
                        {/* Active track */}
                        <div
                          className="absolute h-1 rounded-full bg-primary/70"
                          style={{
                            left: `${((priceMin - PRICE_ABSOLUTE_MIN) / (PRICE_ABSOLUTE_MAX - PRICE_ABSOLUTE_MIN)) * 100}%`,
                            right: `${((PRICE_ABSOLUTE_MAX - priceMax) / (PRICE_ABSOLUTE_MAX - PRICE_ABSOLUTE_MIN)) * 100}%`,
                          }}
                        />
                        {/* Min thumb */}
                        <input
                          type="range"
                          min={PRICE_ABSOLUTE_MIN}
                          max={PRICE_ABSOLUTE_MAX}
                          step={100}
                          value={priceMin}
                          onChange={(e) => {
                            const val = Math.min(
                              Number(e.target.value),
                              priceMax - 100,
                            );
                            setPriceMin(val);
                          }}
                          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-secondary [&::-webkit-slider-thumb]:shadow-[0_1px_6px_rgba(120,0,0,0.22)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-secondary"
                          style={{
                            zIndex: priceMin > PRICE_ABSOLUTE_MAX - 200 ? 5 : 3,
                          }}
                        />
                        {/* Max thumb */}
                        <input
                          type="range"
                          min={PRICE_ABSOLUTE_MIN}
                          max={PRICE_ABSOLUTE_MAX}
                          step={100}
                          value={priceMax}
                          onChange={(e) => {
                            const val = Math.max(
                              Number(e.target.value),
                              priceMin + 100,
                            );
                            setPriceMax(val);
                          }}
                          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-secondary [&::-webkit-slider-thumb]:shadow-[0_1px_6px_rgba(120,0,0,0.22)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-secondary"
                          style={{ zIndex: 4 }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[0.6rem] text-primary/45">
                        <span>
                          ₹{PRICE_ABSOLUTE_MIN.toLocaleString("en-IN")}
                        </span>
                        <span>
                          ₹{PRICE_ABSOLUTE_MAX.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">
                        Size
                      </p>
                      <select
                        aria-label="Filter by size"
                        value={selectedSize}
                        onChange={(event) =>
                          setSelectedSize(event.target.value)
                        }
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
                            const isSelected =
                              normalizeValue(selectedColor) ===
                              normalizeValue(color);
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
                                onClick={() =>
                                  setSelectedColor(isSelected ? "" : color)
                                }
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
                                      backgroundColor: isLight
                                        ? "#1A1A1A"
                                        : "#FFFFFF",
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
                        onChange={(event) =>
                          setOnlyOnSale(event.target.checked)
                        }
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
                        onChange={(event) =>
                          setOnlyInStock(event.target.checked)
                        }
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
        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-primary/15 bg-secondary/90 p-7 text-center text-primary shadow-[0_12px_30px_rgba(120,0,0,0.08)] sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary/65">
              No products found
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Try another search or category
            </h2>
            <p className="mt-3 text-sm text-primary/75 sm:text-base">
              No matching products are available right now.
            </p>
            {activeFilterCount > 0 ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/62">
                {activeFilterCount} active filter
                {activeFilterCount === 1 ? "" : "s"} may be hiding results
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={cartItems[product.id] ?? 0}
                onAddToCart={(productId) => updateCartQuantity(productId, 1)}
                onIncreaseQuantity={(productId) =>
                  updateCartQuantity(productId, (cartItems[productId] ?? 0) + 1)
                }
                onDecreaseQuantity={(productId) =>
                  updateCartQuantity(productId, (cartItems[productId] ?? 0) - 1)
                }
                isWishlisted={Boolean(wishlistItems[product.id])}
                onToggleWishlist={toggleProductWishlist}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
