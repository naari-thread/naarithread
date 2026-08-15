import type { ReactElement } from "react";
import { notFound } from "next/navigation";

import { ProductsCatalog } from "@/app/components/products-catalog";
import { listProductsPageFromCollection, type ProductRecord } from "@/lib/appwrite/products";
import { readProductSearchIndex, type ProductSearchEntry } from "@/lib/firebase/product-search-index";
import {
  getCategoryForSubCategory,
  isProductCategorySlug,
  isProductSubCategorySlug,
} from "@/lib/product-taxonomy";

export const revalidate = 3600;

type SubCategoryProductsPageProps = {
  params: Promise<{ category: string; subcategory: string }>;
};

export default async function SubCategoryProductsPage({
  params,
}: SubCategoryProductsPageProps): Promise<ReactElement> {
  const { category, subcategory } = await params;

  if (!isProductCategorySlug(category) || !isProductSubCategorySlug(subcategory)) {
    notFound();
  }

  if (getCategoryForSubCategory(subcategory) !== category) {
    notFound();
  }

  let initialProducts: ProductRecord[] = [];
  let searchIndex: ProductSearchEntry[] = [];
  let hasFetchError = false;

  try {
    [initialProducts, searchIndex] = await Promise.all([
      listProductsPageFromCollection({ limit: 24, category, subCategory: subcategory }).then(
        (page) => page.products
      ),
      readProductSearchIndex(),
    ]);
  } catch (error) {
    console.error("[subcategory-products-page] Failed to load cached products catalog:", error);
    hasFetchError = true;
  }

  return (
    <main className="min-h-screen bg-paper px-4 pb-32 py-5 text-primary md:px-8 md:pb-20 md:pt-26">
      <ProductsCatalog
        initialProducts={initialProducts}
        searchIndex={searchIndex}
        activeCategorySlug={category}
        activeSubCategorySlug={subcategory}
      />

      {hasFetchError ? (
        <section className="mx-auto mt-4 w-full max-w-7xl rounded-2xl border border-primary/20 bg-secondary p-3.5 text-sm text-primary/80">
          We could not load products right now. Please refresh the page or try again in a moment.
        </section>
      ) : null}
    </main>
  );
}
