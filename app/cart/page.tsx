import { CartPageClient } from "@/app/components/cart-page-client";
import { listProductsFromCollection } from "@/lib/appwrite/products";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CartPage() {
  const products = await listProductsFromCollection().catch(() => []);
  return <CartPageClient products={products} />;
}
