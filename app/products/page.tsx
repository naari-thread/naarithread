import { ProductsCatalog } from "@/app/components/products-catalog";
import { listProductsFromCollection } from "@/lib/appwrite/products";

type ProductsPageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { category } = await searchParams;
  const activeCategory = category ?? "";
  let products: Awaited<ReturnType<typeof listProductsFromCollection>> = [];
  let hasFetchError = false;

  try {
    products = await listProductsFromCollection(activeCategory || undefined);
  } catch {
    hasFetchError = true;
  }

  return (
    <main className="min-h-screen bg-paper px-4 pb-32 pt-20 text-primary md:px-8 md:pb-20 md:pt-26">
      <ProductsCatalog products={products} activeCategory={activeCategory} />

      {hasFetchError ? (
        <section className="mx-auto mt-4 w-full max-w-7xl rounded-2xl border border-primary/20 bg-secondary p-3.5 text-sm text-primary/80">
          We could not load products from Appwrite right now. Please verify Appwrite project and database environment configuration.
        </section>
      ) : null}
    </main>
  );
}
