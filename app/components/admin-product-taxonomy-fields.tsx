"use client";

import { useMemo, useState } from "react";

import {
  PRODUCT_TAXONOMY,
  getCategoryForSubCategory,
  isProductCategorySlug,
  isProductSubCategorySlug,
  normalizeProductCategory,
  type ProductCategorySlug,
  type ProductSubCategorySlug,
} from "@/lib/product-taxonomy";

type AdminProductTaxonomyFieldsProps = {
  initialCategory: string;
  initialSubCategory: string;
  productName: string;
  productDescription: string;
};

function getInitialTaxonomy(args: AdminProductTaxonomyFieldsProps): {
  category: ProductCategorySlug | "";
  subCategory: ProductSubCategorySlug | "";
} {
  const normalized = normalizeProductCategory({
    categoryRaw: args.initialCategory,
    subCategoryRaw: args.initialSubCategory,
    name: args.productName,
    description: args.productDescription,
  });

  const hasCategory = isProductCategorySlug(args.initialCategory) || isProductSubCategorySlug(args.initialSubCategory);
  if (!hasCategory && !args.initialCategory.trim() && !args.initialSubCategory.trim()) {
    return { category: "", subCategory: "" };
  }

  return {
    category: normalized.category,
    subCategory: normalized.subCategory,
  };
}

export function AdminProductTaxonomyFields(props: AdminProductTaxonomyFieldsProps) {
  const initial = useMemo(() => getInitialTaxonomy(props), [props]);
  const [category, setCategory] = useState<ProductCategorySlug | "">(initial.category);
  const [subCategory, setSubCategory] = useState<ProductSubCategorySlug | "">(initial.subCategory);

  const subCategoryOptions = category
    ? PRODUCT_TAXONOMY.find((item) => item.slug === category)?.subCategories ?? []
    : [];

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Category</span>
        <select
          aria-label="Product category"
          name="category"
          value={category}
          onChange={(event) => {
            const nextCategory = event.target.value as ProductCategorySlug | "";
            setCategory(nextCategory);
            setSubCategory("");
          }}
          className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm"
          required
        >
          <option value="" disabled>
            Select category
          </option>
          {PRODUCT_TAXONOMY.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Sub Category</span>
        <select
          aria-label="Product sub category"
          name="subcategory"
          value={subCategory && getCategoryForSubCategory(subCategory) === category ? subCategory : ""}
          onChange={(event) => setSubCategory(event.target.value as ProductSubCategorySlug)}
          className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm disabled:cursor-not-allowed disabled:opacity-55"
          disabled={!category}
          required
        >
          <option value="" disabled>
            {category ? "Select sub category" : "Select category first"}
          </option>
          {subCategoryOptions.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
