import { NextResponse } from "next/server";
import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";

export const runtime = "nodejs";
export const revalidate = 3600; // refresh filters once per hour

function enumElementsFromAttribute(attribute: unknown) {
  if (!attribute || typeof attribute !== "object") {
    return [] as string[];
  }

  if (!("elements" in attribute)) {
    return [] as string[];
  }

  const candidate = (attribute as { elements?: unknown }).elements;
  if (!Array.isArray(candidate)) {
    return [] as string[];
  }

  return candidate.filter((item): item is string => typeof item === "string");
}

function toUniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

export async function GET() {
  try {
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const productsCollectionId = "sku";

    const [collection, documents] = await Promise.all([
      databases.getCollection(databaseId, productsCollectionId),
      databases.listDocuments(databaseId, productsCollectionId, [Query.limit(500), Query.orderDesc("$createdAt")]),
    ]);

    const categoryAttribute = collection.attributes.find((attribute) => attribute.key === "category");
    const subcategoryAttribute = collection.attributes.find((attribute) => attribute.key === "subcategory");
    const sizeAttribute = collection.attributes.find((attribute) => attribute.key === "size");

    const categoriesFromSchema = enumElementsFromAttribute(categoryAttribute);
    const subcategoriesFromSchema = enumElementsFromAttribute(subcategoryAttribute);
    const sizesFromSchema = enumElementsFromAttribute(sizeAttribute);

    const categoriesFromRows: string[] = [];
    const subcategoriesFromRows: string[] = [];
    const colorsFromRows: string[] = [];

    for (const document of documents.documents) {
      const category = String(document.category ?? "").trim();
      const subcategory = String(document.subcategory ?? document.subCategory ?? "").trim();

      if (category) {
        categoriesFromRows.push(category);
      }

      if (subcategory) {
        subcategoriesFromRows.push(subcategory);
      }

      const colors = Array.isArray(document.colorOptions)
        ? document.colorOptions.filter((item): item is string => typeof item === "string")
        : [];

      for (const color of colors) {
        if (color.trim()) {
          colorsFromRows.push(color);
        }
      }
    }

    const payload = {
      categories: toUniqueSorted([...categoriesFromSchema, ...categoriesFromRows]),
      subcategories: toUniqueSorted([...subcategoriesFromSchema, ...subcategoriesFromRows]),
      sizes: toUniqueSorted(sizesFromSchema),
      colors: toUniqueSorted(colorsFromRows),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load catalog filters.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
