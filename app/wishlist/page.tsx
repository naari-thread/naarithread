import { WishlistPageClient } from "@/app/components/wishlist-page-client";
import { listProductsFromCollection } from "@/lib/appwrite/products";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WishlistPage() {
  const products = await listProductsFromCollection().catch(() => []);
  return <WishlistPageClient products={products} />;
}
