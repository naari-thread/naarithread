"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { ProductCard } from "@/app/components/product-card";
import { readCartItems, subscribeToCartChanges, writeCartItems, type CartItemsMap } from "@/lib/cart-state";
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
  return product.originalPrice > 0 && product.discountPrice > 0 && product.discountPrice < product.originalPrice;
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

function toUniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
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
}: SelectDropdownProps) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Open ${label} dropdown`}
        aria-expanded={open}
        onClick={onToggle}
        className="inline-flex h-11 min-w-[170px] items-center justify-between gap-2 rounded-xl border border-primary/18 bg-secondary px-3 text-sm text-primary/88 transition hover:border-primary/35"
      >
        <span className="truncate">{value || placeholder}</span>
        <span className="inline-flex items-center gap-1.5">
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
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/14 text-primary/66 transition hover:border-primary/28 hover:text-primary"
            >
              <DynamicHugeIcon name="Cancel01Icon" className="h-3.5 w-3.5" iconStrokeWidth={2} aria-hidden={true} />
            </span>
          ) : null}

          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <DynamicHugeIcon name="ArrowRight01Icon" className="h-4 w-4 text-primary/65" iconStrokeWidth={2} aria-hidden={true} />
          </motion.span>
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-[calc(100%+8px)] z-20 w-full min-w-[210px] overflow-hidden rounded-xl border border-primary/16 bg-secondary shadow-[0_18px_36px_rgba(120,0,0,0.16)]"
          >
            <button
              type="button"
              onClick={() => onSelect("")}
              className="block w-full border-b border-primary/8 px-3 py-2.5 text-left text-sm text-primary/72 transition hover:bg-primary/[0.05] hover:text-primary"
            >
              All
            </button>
            <div className="max-h-56 overflow-y-auto overscroll-contain" onWheel={(event) => event.stopPropagation()}>
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelect(option.value)}
                  className="block w-full px-3 py-2.5 text-left text-sm text-primary/82 transition hover:bg-primary/[0.05] hover:text-primary"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function ProductsCatalog({ products, activeCategorySlug, activeSubCategorySlug }: ProductsCatalogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchText, setSearchText] = useState("");
  const [cartItems, setCartItems] = useState<CartItemsMap>({});
  const [wishlistItems, setWishlistItems] = useState<WishlistItemsMap>({});
  const [filterPayload, setFilterPayload] = useState<CatalogFilterPayload>({
    sizes: [],
    colors: [],
  });
  const [selectedCategory, setSelectedCategory] = useState<ProductCategorySlug | "">("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<ProductSubCategorySlug | "">("");
  useEffect(() => {
    setSelectedCategory(isProductCategorySlug(activeCategorySlug) ? activeCategorySlug : "");
    setSelectedSubCategory(isProductSubCategorySlug(activeSubCategorySlug) ? activeSubCategorySlug : "");
  }, [activeCategorySlug, activeSubCategorySlug]);

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [onlyOnSale, setOnlyOnSale] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [subCategoryOpen, setSubCategoryOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    setCartItems(readCartItems());
    return subscribeToCartChanges((items) => setCartItems(items));
  }, []);

  useEffect(() => {
    setWishlistItems(readWishlistItems());
    return subscribeToWishlistChanges((items) => setWishlistItems(items));
  }, []);

  const navigateForFilter = (category: ProductCategorySlug | "", subCategory: ProductSubCategorySlug | "") => {
    const nextPath = subCategory ? `/products/${category}/${subCategory}` : category ? `/products/${category}` : "/products";
    if (pathname !== nextPath) {
      router.push(nextPath);
    }
  };

  useEffect(() => {
    let alive = true;

    async function loadFilterPayload() {
      try {
        const response = await fetch("/api/catalog/filters", { cache: "no-store" });
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

    setCartItems((previous) => {
      const nextItems: CartItemsMap = {
        ...previous,
      };

      if (nextQuantity <= 0) {
        delete nextItems[productId];
      } else {
        nextItems[productId] = nextQuantity;
      }

      writeCartItems(nextItems);
      return nextItems;
    });
  };

  const availableCategories = useMemo(() => {
    return PRODUCT_TAXONOMY.map((item) => ({ label: item.label, value: item.slug }));
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
    return toUniqueSorted([...filterPayload.sizes, ...products.flatMap((item) => item.sizeOptions)]);
  }, [filterPayload.sizes, products]);

  const availableColors = useMemo(() => {
    return toUniqueSorted([...filterPayload.colors, ...products.flatMap((item) => item.colorOptions)]);
  }, [filterPayload.colors, products]);

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    const exists = availableCategories.some((item) => item.value === selectedCategory);
    if (!exists) {
      setSelectedCategory("");
      setSelectedSubCategory("");
    }
  }, [availableCategories, selectedCategory]);

  useEffect(() => {
    if (!selectedSubCategory) {
      return;
    }

    const exists = availableSubCategories.some((item) => item.value === selectedSubCategory);
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

      if (selectedSize && !product.sizeOptions.some((size) => normalizeValue(size) === normalizeValue(selectedSize))) {
        return false;
      }

      if (selectedColor && !product.colorOptions.some((color) => normalizeValue(color) === normalizeValue(selectedColor))) {
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
  ]);

  const activeFilterCount = [
    selectedCategory,
    selectedSubCategory,
    selectedSize,
    selectedColor,
    onlyOnSale ? "on-sale" : "",
    onlyNew ? "new" : "",
    onlyInStock ? "in-stock" : "",
  ].filter(Boolean).length;

  const toggleProductWishlist = (productId: string) => {
    toggleWishlistItem(productId);
  };

  return (
    <>
      <section className="mx-auto w-full max-w-7xl">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="mb-1 sm:mb-0">
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.26em] text-primary/60">Products</p>
            <h1 className="mt-1 font-display text-3xl leading-tight sm:text-4xl">Shop The Collection</h1>
          </div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-primary/60 sm:block">
            {filteredProducts.length} item{filteredProducts.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-b border-primary/12 pb-4 sm:gap-3">
          <div className="hidden items-center gap-3 sm:flex">
            <SelectDropdown
              label="Categories"
              placeholder="All Categories"
              value={selectedCategory ? getCategoryLabelBySlug(selectedCategory) : ""}
              options={availableCategories}
              clearable={true}
              open={categoryOpen}
              onToggle={() => {
                setCategoryOpen((prev) => !prev);
                setSubCategoryOpen(false);
                setFilterOpen(false);
              }}
              onSelect={(value) => {
                if (!isProductCategorySlug(value)) {
                  setSelectedCategory("");
                  setSelectedSubCategory("");
                  navigateForFilter("", "");
                  setCategoryOpen(false);
                  return;
                }

                setSelectedCategory(value);
                setSelectedSubCategory("");
                navigateForFilter(value, "");
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
              value={selectedSubCategory ? getSubCategoryLabelBySlug(selectedSubCategory) : ""}
              options={availableSubCategories}
              clearable={true}
              open={subCategoryOpen}
              onToggle={() => {
                setSubCategoryOpen((prev) => !prev);
                setCategoryOpen(false);
                setFilterOpen(false);
              }}
              onSelect={(value) => {
                if (!isProductSubCategorySlug(value)) {
                  setSelectedSubCategory("");
                  navigateForFilter(selectedCategory, "");
                  setSubCategoryOpen(false);
                  return;
                }

                const nextCategory = selectedCategory || getCategoryForSubCategory(value);
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
          </div>

          <div className="min-w-[220px] flex-1">
            <label
              htmlFor="products-search"
              className="group flex h-11 w-full items-center gap-2.5 rounded-xl border border-primary/12 bg-secondary px-3.5"
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

          <div className="relative">
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
              <DynamicHugeIcon name="FilterHorizontalIcon" className="h-4.5 w-4.5" iconStrokeWidth={1.9} aria-hidden={true} />
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
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-primary/62">Advanced Filters</p>

                  <div className="mt-3 space-y-2.5">
                    <div className="block sm:hidden">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">Category</p>
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
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">Subcategory</p>
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

                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">Size</p>
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

                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">Color</p>
                      <select
                        aria-label="Filter by color"
                        value={selectedColor}
                        onChange={(event) => setSelectedColor(event.target.value)}
                        className="h-10 w-full rounded-lg border border-primary/16 bg-paper px-2.5 text-sm text-primary outline-none"
                      >
                        <option value="">All colors</option>
                        {availableColors.map((color) => (
                          <option key={color} value={color}>
                            {color}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-primary/86">
                      <input type="checkbox" checked={onlyOnSale} onChange={(event) => setOnlyOnSale(event.target.checked)} />
                      On Sale
                    </label>
                    <label className="flex items-center gap-2 text-sm text-primary/86">
                      <input type="checkbox" checked={onlyNew} onChange={(event) => setOnlyNew(event.target.checked)} />
                      New Arrivals
                    </label>
                    <label className="flex items-center gap-2 text-sm text-primary/86">
                      <input type="checkbox" checked={onlyInStock} onChange={(event) => setOnlyInStock(event.target.checked)} />
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
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary/65">No products found</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Try another search or category</h2>
            <p className="mt-3 text-sm text-primary/75 sm:text-base">No matching products are available right now.</p>
            {activeFilterCount > 0 ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/62">
                {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"} may be hiding results
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                quantity={cartItems[product.id] ?? 0}
                onAddToCart={(productId) => updateCartQuantity(productId, 1)}
                onIncreaseQuantity={(productId) => updateCartQuantity(productId, (cartItems[productId] ?? 0) + 1)}
                onDecreaseQuantity={(productId) => updateCartQuantity(productId, (cartItems[productId] ?? 0) - 1)}
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
