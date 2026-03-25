import "dotenv/config";

import {
  Client,
  Databases,
  Permission,
  Role,
} from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const configuredDatabaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "naarithread";
let databaseId = configuredDatabaseId;

if (!projectId || !apiKey) {
  throw new Error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const collectionDefs = [
  {
    id: "users",
    name: "users",
    permissions: [
      Permission.create(Role.users()),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: true,
    attributes: [
      ["string", "userId", 64, true],
      ["string", "fullName", 120, true],
      ["string", "email", 255, true],
      ["string", "phone", 32, false],
      ["string", "address", 500, false],
      ["boolean", "isAdmin", false, false],
    ],
    indexes: [
      ["users_userId_unique", "unique", ["userId"]],
      ["users_email_unique", "unique", ["email"]],
    ],
  },
  {
    id: "products",
    name: "products",
    permissions: [
      Permission.read(Role.any()),
      Permission.create(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: false,
    attributes: [
      ["string", "name", 180, true],
      ["string", "description", 5000, true],
      ["double", "rating", 0, false],
      ["integer", "ratingCount", 0, false],
      ["string", "reviewIds", 64, false, true],
      ["string", "colorOptions", 40, false, true],
      ["string", "sizeOptions", 40, false, true],
      ["string", "mainImageUrl", 1000, true],
      ["string", "otherImageUrls", 1000, false, true],
      ["double", "discountPrice", 0, true],
      ["double", "originalPrice", 0, true],
      ["string", "sku", 100, true],
      ["string", "category", 100, true],
      ["integer", "stockQty", 0, true],
      ["boolean", "isActive", true, false],
    ],
    indexes: [
      ["products_sku_unique", "unique", ["sku"]],
      ["products_category_idx", "key", ["category"]],
      ["products_active_idx", "key", ["isActive"]],
    ],
  },
  {
    id: "orders",
    name: "orders",
    permissions: [
      Permission.create(Role.users()),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: true,
    attributes: [
      ["string", "orderNumber", 80, true],
      ["string", "userId", 64, true],
      ["string", "userEmail", 255, true],
      ["string", "status", 40, true],
      ["string", "paymentStatus", 40, true],
      ["string", "itemsJson", 20000, true],
      ["double", "totalAmount", 0, true],
      ["double", "discountAmount", 0, false],
      ["double", "shippingAmount", 0, false],
      ["string", "couponCode", 80, false],
      ["string", "paymentId", 64, false],
      ["string", "shippingAddress", 1000, true],
      ["datetime", "placedAt", true],
    ],
    indexes: [
      ["orders_orderNumber_unique", "unique", ["orderNumber"]],
      ["orders_userId_idx", "key", ["userId"]],
      ["orders_status_idx", "key", ["status"]],
    ],
  },
  {
    id: "payments",
    name: "payments",
    permissions: [
      Permission.create(Role.users()),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: true,
    attributes: [
      ["string", "userId", 64, true],
      ["string", "orderId", 64, true],
      ["string", "provider", 40, true],
      ["string", "providerPaymentId", 120, false],
      ["string", "status", 40, true],
      ["double", "amount", 0, true],
      ["string", "currency", 8, true],
      ["string", "paymentMeta", 20000, false],
      ["datetime", "paidAt", false],
    ],
    indexes: [
      ["payments_orderId_idx", "key", ["orderId"]],
      ["payments_userId_idx", "key", ["userId"]],
    ],
  },
  {
    id: "coupons",
    name: "coupons",
    permissions: [
      Permission.read(Role.any()),
      Permission.create(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: false,
    attributes: [
      ["string", "code", 60, true],
      ["string", "description", 500, false],
      ["string", "discountType", 20, true],
      ["double", "discountValue", 0, true],
      ["double", "minOrderValue", 0, false],
      ["double", "maxDiscount", 0, false],
      ["boolean", "isActive", true, false],
      ["integer", "usageLimit", 0, false],
      ["integer", "usedCount", 0, false],
      ["datetime", "startsAt", false],
      ["datetime", "expiresAt", false],
    ],
    indexes: [["coupons_code_unique", "unique", ["code"]]],
  },
  {
    id: "reviews",
    name: "reviews",
    permissions: [
      Permission.read(Role.any()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: true,
    attributes: [
      ["string", "productId", 64, true],
      ["string", "userId", 64, true],
      ["string", "userName", 120, true],
      ["string", "userEmail", 255, true],
      ["integer", "rating", 0, true],
      ["string", "title", 200, false],
      ["string", "comment", 2000, true],
      ["boolean", "isVerifiedPurchase", false, false],
      ["boolean", "isApproved", true, false],
    ],
    indexes: [
      ["reviews_productId_idx", "key", ["productId"]],
      ["reviews_userId_idx", "key", ["userId"]],
    ],
  },
  {
    id: "wishlist",
    name: "wishlist",
    permissions: [
      Permission.create(Role.users()),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: true,
    attributes: [
      ["string", "userId", 64, true],
      ["string", "productId", 64, true],
      ["datetime", "addedAt", true],
    ],
    indexes: [
      ["wishlist_userId_idx", "key", ["userId"]],
      ["wishlist_user_product_unique", "unique", ["userId", "productId"]],
    ],
  },
  {
    id: "banner",
    name: "banner",
    permissions: [
      Permission.read(Role.any()),
      Permission.create(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: false,
    attributes: [
      ["string", "title", 180, true],
      ["string", "subtitle", 500, false],
      ["string", "imageUrl", 1000, true],
      ["string", "ctaLabel", 80, false],
      ["string", "ctaUrl", 500, false],
      ["integer", "position", 0, true],
      ["boolean", "isActive", true, false],
      ["datetime", "startAt", false],
      ["datetime", "endAt", false],
    ],
    indexes: [
      ["banner_active_idx", "key", ["isActive"]],
      ["banner_position_idx", "key", ["position"]],
    ],
  },
  {
    id: "notifications",
    name: "notifications",
    permissions: [
      Permission.create(Role.users()),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
    ],
    documentSecurity: true,
    attributes: [
      ["string", "userId", 64, true],
      ["string", "title", 200, true],
      ["string", "body", 1000, true],
      ["string", "type", 80, true],
      ["boolean", "isRead", false, false],
      ["string", "metadata", 20000, false],
      ["datetime", "sentAt", true],
    ],
    indexes: [
      ["notifications_user_idx", "key", ["userId"]],
      ["notifications_read_idx", "key", ["isRead"]],
    ],
  },
];

async function safeCall(label, operation) {
  try {
    await operation();
    console.log(`Created ${label}`);
  } catch (error) {
    const message = String(error?.message ?? error);
    if (message.includes("already exists")) {
      console.log(`Skipped ${label} (already exists)`);
      return;
    }

    throw error;
  }
}

async function createDatabaseIfMissing() {
  try {
    await databases.get(databaseId);
    console.log(`Using existing database: ${databaseId}`);
  } catch {
    const existing = await databases.list();
    const byName = existing.databases.find((item) => item.name.toLowerCase() === "naarithread");

    if (byName) {
      databaseId = byName.$id;
      console.log(`Using existing database by name: ${databaseId}`);
      return;
    }

    await databases.create(databaseId, "naarithread");
    console.log(`Created database: ${databaseId}`);
  }
}

async function createAttribute(databaseIdValue, collectionId, definition) {
  const [type, key, arg3, arg4, arg5] = definition;

  if (type === "string") {
    await databases.createStringAttribute({
      databaseId: databaseIdValue,
      collectionId,
      key,
      size: arg3,
      required: arg4,
      array: Boolean(arg5),
    });
    return;
  }

  if (type === "integer") {
    await databases.createIntegerAttribute({
      databaseId: databaseIdValue,
      collectionId,
      key,
      required: arg4,
      xdefault: !arg4 && typeof arg3 === "number" ? arg3 : undefined,
    });
    return;
  }

  if (type === "double") {
    await databases.createFloatAttribute({
      databaseId: databaseIdValue,
      collectionId,
      key,
      required: arg4,
      xdefault: !arg4 && typeof arg3 === "number" ? arg3 : undefined,
    });
    return;
  }

  if (type === "boolean") {
    await databases.createBooleanAttribute({
      databaseId: databaseIdValue,
      collectionId,
      key,
      required: arg4,
      xdefault: arg3,
    });
    return;
  }

  if (type === "datetime") {
    await databases.createDatetimeAttribute({
      databaseId: databaseIdValue,
      collectionId,
      key,
      required: arg3,
    });
  }
}

async function setupCollections() {
  for (const collection of collectionDefs) {
    await safeCall(`collection ${collection.id}`, async () => {
      await databases.createCollection(
        databaseId,
        collection.id,
        collection.name,
        collection.permissions,
        collection.documentSecurity,
        true
      );
    });

    for (const attribute of collection.attributes) {
      const [, attributeKey] = attribute;
      await safeCall(`attribute ${collection.id}.${attributeKey}`, async () => {
        await createAttribute(databaseId, collection.id, attribute);
      });
    }

    for (const [indexName, indexType, attributes] of collection.indexes) {
      await safeCall(`index ${collection.id}.${indexName}`, async () => {
        await databases.createIndex(databaseId, collection.id, indexName, indexType, attributes);
      });
    }
  }
}

async function run() {
  await createDatabaseIfMissing();
  await setupCollections();
  console.log("Appwrite database bootstrap complete.");
}

run().catch((error) => {
  console.error("Failed to bootstrap Appwrite database:", error);
  process.exit(1);
});
