import { notFound } from "next/navigation";

import { ProductsCatalog } from "@/app/components/products-catalog";
import { listProductsFromCollection } from "@/lib/appwrite/products";
import { getCategoryForSubCategory, isProductCategorySlug, isProductSubCategorySlug } from "@/lib/product-taxonomy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SubCategoryProductsPageProps = {
  params: Promise<{ category: string; subcategory: string }>;
};

export default async function SubCategoryProductsPage({ params }: SubCategoryProductsPageProps) {
  const { category, subcategory } = await params;

  if (!isProductCategorySlug(category) || !isProductSubCategorySlug(subcategory)) {
    notFound();
  }

  if (getCategoryForSubCategory(subcategory) !== category) {
    notFound();
  }

  let products: Awaited<ReturnType<typeof listProductsFromCollection>> = [];
  let hasFetchError = false;

  try {
    products = await listProductsFromCollection();
  } catch {
    hasFetchError = true;
  }

  return (
    <main className="min-h-screen bg-paper px-4 pb-32 py-5 text-primary md:px-8 md:pb-20 md:pt-26">
      <ProductsCatalog products={products} activeCategorySlug={category} activeSubCategorySlug={subcategory} />

      {hasFetchError ? (
        <section className="mx-auto mt-4 w-full max-w-7xl rounded-2xl border border-primary/20 bg-secondary p-3.5 text-sm text-primary/80">
          We could not load products from Appwrite right now. Please verify Appwrite project and database environment configuration.
        </section>
      ) : null}
    </main>
  );
}
