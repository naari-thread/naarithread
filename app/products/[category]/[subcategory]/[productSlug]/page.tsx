import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";

import { ProductDetailsClient } from "@/app/components/product-details-client";
import { getProductBySlug, getRelatedProducts } from "@/lib/appwrite/products";
import {
  getCategoryForSubCategory,
  getCategoryLabelBySlug,
  getSubCategoryLabelBySlug,
  isProductCategorySlug,
  isProductSubCategorySlug,
} from "@/lib/product-taxonomy";

export const revalidate = 900;

type ProductDetailsPageProps = {
  params: Promise<{
    category: string;
    subcategory: string;
    productSlug: string;
  }>;
};

export async function generateMetadata({
  params,
}: ProductDetailsPageProps): Promise<Metadata> {
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
      images: product.mainImageUrl
        ? [{ url: product.mainImageUrl, alt: product.name }]
        : undefined,
    },
  };
}

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const { category, subcategory, productSlug } = await params;

  if (
    !isProductCategorySlug(category) ||
    !isProductSubCategorySlug(subcategory)
  ) {
    notFound();
  }

  if (getCategoryForSubCategory(subcategory) !== category) {
    notFound();
  }

  const product = await getProductBySlug(productSlug);
  if (
    !product ||
    product.category !== category ||
    product.subCategory !== subcategory
  ) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product, 4);

  const sellingPrice =
    product.discountPrice > 0 ? product.discountPrice : product.originalPrice;
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    image: [product.mainImageUrl, ...product.otherImageUrls].filter(Boolean),
    description: product.description,
    brand: { "@type": "Brand", name: "NaariThread" },
    sku: product.sku,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: sellingPrice,
      availability:
        product.stockQty > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `https://naarithread.com/products/${product.category}/${product.subCategory}/${product.slug}`,
    },
    ...(product.ratingCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating.toFixed(1),
        reviewCount: product.ratingCount,
        bestRating: "5",
        worstRating: "1",
      },
    }),
  };

  return (
    <>
      <Script
        id="product-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailsClient
        product={product}
        category={category}
        categoryLabel={getCategoryLabelBySlug(category)}
        subCategoryLabel={getSubCategoryLabelBySlug(subcategory)}
        relatedProducts={relatedProducts}
      />
    </>
  );
}
