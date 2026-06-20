import { ProductsCatalog } from "@/app/components/products-catalog";
import { listProductsFromCollection } from "@/lib/appwrite/products";

export const revalidate = 900;

export default async function ProductsPage() {
  let products: Awaited<ReturnType<typeof listProductsFromCollection>> = [];
  let hasFetchError = false;

  try {
    products = await listProductsFromCollection();
  } catch (error) {
    console.error("[products-page] Failed to load products", error);
    hasFetchError = true;
  }

  return (
    <main className="min-h-screen bg-paper px-4 pb-32 py-5 md:pt-20 text-primary md:px-8 md:pb-20 md:pt-26">
      <ProductsCatalog products={products} activeCategorySlug="" activeSubCategorySlug="" />

      {hasFetchError ? (
        <section className="mx-auto mt-4 w-full max-w-7xl rounded-2xl border border-primary/20 bg-secondary p-3.5 text-sm text-primary/80">
          We could not load products from Firebase right now. Please verify Firebase project and Firestore environment configuration.
        </section>
      ) : null}
    </main>
  );
}
