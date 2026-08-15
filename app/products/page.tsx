import type { ReactElement } from "react";

import { ProductsCatalog } from "@/app/components/products-catalog";
import { listProductsPageFromCollection, type ProductRecord } from "@/lib/appwrite/products";
import { readProductSearchIndex, type ProductSearchEntry } from "@/lib/firebase/product-search-index";

export const revalidate = 3600;

export default async function ProductsPage(): Promise<ReactElement> {
  let initialProducts: ProductRecord[] = [];
  let searchIndex: ProductSearchEntry[] = [];
  let hasFetchError = false;

  try {
    [initialProducts, searchIndex] = await Promise.all([
      listProductsPageFromCollection({ limit: 24 }).then((page) => page.products),
      readProductSearchIndex(),
    ]);
  } catch (error) {
    console.error("[products-page] Failed to load cached products catalog:", error);
    hasFetchError = true;
  }

  return (
    <main className="min-h-screen bg-paper px-4 pb-32 py-5 text-primary md:px-8 md:pb-20 md:pt-26">
      <ProductsCatalog
        initialProducts={initialProducts}
        searchIndex={searchIndex}
        activeCategorySlug=""
        activeSubCategorySlug=""
      />

      {hasFetchError ? (
        <section className="mx-auto mt-4 w-full max-w-7xl rounded-2xl border border-primary/20 bg-secondary p-3.5 text-sm text-primary/80">
          We could not load products right now. Please refresh the page or try again in a moment.
        </section>
      ) : null}
    </main>
  );
}
