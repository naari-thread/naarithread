import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetailsClient } from "@/app/components/product-details-client";
import { getProductBySlug, getRelatedProducts } from "@/lib/appwrite/products";
import { getCategoryForSubCategory, getCategoryLabelBySlug, getSubCategoryLabelBySlug, isProductCategorySlug, isProductSubCategorySlug } from "@/lib/product-taxonomy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductDetailsPageProps = {
  params: Promise<{ category: string; subcategory: string; productSlug: string }>;
};

export async function generateMetadata({ params }: ProductDetailsPageProps): Promise<Metadata> {
  const { productSlug } = await params;
  const product = await getProductBySlug(productSlug);

  if (!product) {
    return {};
  }

  return {
    title: product.name,
    description: product.description,
    alternates: {
      canonical: `/products/${product.category}/${product.subCategory}/${product.slug}`,
    },
    openGraph: {
      title: product.name,
      description: product.description,
      images: product.mainImageUrl ? [{ url: product.mainImageUrl, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const { category, subcategory, productSlug } = await params;

  if (!isProductCategorySlug(category) || !isProductSubCategorySlug(subcategory)) {
    notFound();
  }

  if (getCategoryForSubCategory(subcategory) !== category) {
    notFound();
  }

  const product = await getProductBySlug(productSlug);
  if (!product || product.category !== category || product.subCategory !== subcategory) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product, 4);

  return (
    <ProductDetailsClient
      product={product}
      category={category}
      categoryLabel={getCategoryLabelBySlug(category)}
      subCategoryLabel={getSubCategoryLabelBySlug(subcategory)}
      relatedProducts={relatedProducts}
    />
  );
}
