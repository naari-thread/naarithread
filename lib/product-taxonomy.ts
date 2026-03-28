export type ProductCategorySlug = "ethnic-wear" | "western-wear" | "bottom-wear" | "fusion-wear";

export type ProductSubCategorySlug =
  | "saree"
  | "lehenga"
  | "anarkali"
  | "dresses"
  | "tops"
  | "skirts"
  | "jeans"
  | "trousers-pants"
  | "palazzo"
  | "indo-western-dresses"
  | "crop-top-skirt"
  | "kurti-jeans";

export type ProductCategoryDefinition = {
  label: string;
  slug: ProductCategorySlug;
  note: string;
  subCategories: Array<{ label: string; slug: ProductSubCategorySlug }>;
};

export const PRODUCT_TAXONOMY: ProductCategoryDefinition[] = [
  {
    label: "Ethnic",
    slug: "ethnic-wear",
    note: "Sarees, Lehengas, Anarkalis",
    subCategories: [
      { label: "Saree", slug: "saree" },
      { label: "Lehenga", slug: "lehenga" },
      { label: "Anarkali", slug: "anarkali" },
    ],
  },
  {
    label: "Western",
    slug: "western-wear",
    note: "Dresses, Tops, Skirts",
    subCategories: [
      { label: "Dresses", slug: "dresses" },
      { label: "Tops", slug: "tops" },
      { label: "Skirts", slug: "skirts" },
    ],
  },
  {
    label: "Bottom",
    slug: "bottom-wear",
    note: "Jeans, Trousers, Palazzo",
    subCategories: [
      { label: "Jeans", slug: "jeans" },
      { label: "Trousers", slug: "trousers-pants" },
      { label: "Palazzo", slug: "palazzo" },
    ],
  },
  {
    label: "Fusion",
    slug: "fusion-wear",
    note: "Indo-western statement sets",
    subCategories: [
      { label: "Indo-Western Dresses", slug: "indo-western-dresses" },
      { label: "Crop Top + Skirt", slug: "crop-top-skirt" },
      { label: "Kurti + Jeans", slug: "kurti-jeans" },
    ],
  },
];

const CATEGORY_MAP = new Map(PRODUCT_TAXONOMY.map((item) => [item.slug, item]));
const CATEGORY_LABEL_TO_SLUG = new Map(
  PRODUCT_TAXONOMY.map((item) => [item.label.trim().toLowerCase(), item.slug] as const)
);

const SUBCATEGORY_TO_CATEGORY = new Map<ProductSubCategorySlug, ProductCategorySlug>(
  PRODUCT_TAXONOMY.flatMap((item) => item.subCategories.map((sub) => [sub.slug, item.slug] as const))
);

const SUBCATEGORY_LABEL_MAP = new Map<ProductSubCategorySlug, string>(
  PRODUCT_TAXONOMY.flatMap((item) => item.subCategories.map((sub) => [sub.slug, sub.label] as const))
);
const SUBCATEGORY_LABEL_TO_SLUG = new Map(
  PRODUCT_TAXONOMY.flatMap((item) =>
    item.subCategories.map((sub) => [sub.label.trim().toLowerCase(), sub.slug] as const)
  )
);

export function isProductCategorySlug(value: string): value is ProductCategorySlug {
  return CATEGORY_MAP.has(value as ProductCategorySlug);
}

export function isProductSubCategorySlug(value: string): value is ProductSubCategorySlug {
  return SUBCATEGORY_TO_CATEGORY.has(value as ProductSubCategorySlug);
}

export function getCategoryLabelBySlug(slug: ProductCategorySlug) {
  return CATEGORY_MAP.get(slug)?.label ?? "Ethnic";
}

export function getCategorySlugByLabel(label: string): ProductCategorySlug | null {
  return CATEGORY_LABEL_TO_SLUG.get(label.trim().toLowerCase()) ?? null;
}

export function getSubCategoryLabelBySlug(slug: ProductSubCategorySlug) {
  return SUBCATEGORY_LABEL_MAP.get(slug) ?? "Saree";
}

export function getSubCategorySlugByLabel(label: string): ProductSubCategorySlug | null {
  return SUBCATEGORY_LABEL_TO_SLUG.get(label.trim().toLowerCase()) ?? null;
}

export function getSubCategoriesByCategory(slug: ProductCategorySlug) {
  return CATEGORY_MAP.get(slug)?.subCategories ?? [];
}

export function getCategoryForSubCategory(slug: ProductSubCategorySlug) {
  return SUBCATEGORY_TO_CATEGORY.get(slug) ?? "ethnic-wear";
}

function scoreKeywordMatches(text: string, words: string[]) {
  return words.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
}

function inferCategoryFromText(text: string): ProductCategorySlug {
  const scores: Array<{ slug: ProductCategorySlug; score: number }> = [
    { slug: "ethnic-wear", score: scoreKeywordMatches(text, ["saree", "lehenga", "anarkali", "kurti"]) },
    { slug: "western-wear", score: scoreKeywordMatches(text, ["dress", "top", "skirt", "gown"]) },
    { slug: "bottom-wear", score: scoreKeywordMatches(text, ["jeans", "trouser", "pants", "palazzo", "bottom"]) },
    {
      slug: "fusion-wear",
      score: scoreKeywordMatches(text, ["fusion", "indo", "crop", "set", "co-ord", "coord"]),
    },
  ];

  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score > 0) {
    return scores[0].slug;
  }

  return "ethnic-wear";
}

function inferSubCategoryFromText(category: ProductCategorySlug, text: string): ProductSubCategorySlug {
  const candidates = getSubCategoriesByCategory(category);
  for (const candidate of candidates) {
    if (text.includes(candidate.slug.replace(/-/g, " ")) || text.includes(candidate.label.toLowerCase())) {
      return candidate.slug;
    }
  }

  return candidates[0]?.slug ?? "saree";
}

export function normalizeProductCategory(args: {
  categoryRaw: string;
  subCategoryRaw: string;
  name: string;
  description: string;
}): { category: ProductCategorySlug; subCategory: ProductSubCategorySlug } {
  const categoryRaw = args.categoryRaw.trim().toLowerCase();
  const subCategoryRaw = args.subCategoryRaw.trim().toLowerCase();

  if (isProductSubCategorySlug(subCategoryRaw)) {
    return {
      category: getCategoryForSubCategory(subCategoryRaw),
      subCategory: subCategoryRaw,
    };
  }

  if (isProductCategorySlug(categoryRaw)) {
    const inferredSub = inferSubCategoryFromText(categoryRaw, `${args.name} ${args.description}`.toLowerCase());
    return {
      category: categoryRaw,
      subCategory: inferredSub,
    };
  }

  const inferredCategory = inferCategoryFromText(`${categoryRaw} ${args.name} ${args.description}`.toLowerCase());
  const inferredSubCategory = inferSubCategoryFromText(inferredCategory, `${args.name} ${args.description}`.toLowerCase());
  return { category: inferredCategory, subCategory: inferredSubCategory };
}
