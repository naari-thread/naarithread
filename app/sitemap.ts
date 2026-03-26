import type { MetadataRoute } from "next";

import { generateStaticParams as generatePolicyStaticParams } from "@/app/policies/[slug]/page";

const DEFAULT_SITE_URL = "https://www.naarithread.com";

function getSiteUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!envUrl) {
    return DEFAULT_SITE_URL;
  }

  return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  // Keep sitemap focused on public SEO pages and avoid account/admin utility routes.
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const policyParams = await generatePolicyStaticParams();

  const policyRoutes: MetadataRoute.Sitemap = policyParams.map(({ slug }) => ({
    url: `${siteUrl}/policies/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...policyRoutes];
}