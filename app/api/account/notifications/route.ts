import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";

export const runtime = "nodejs";

const NOTIFICATIONS_COL = "notifications";
const ORDERS_COL = "orders";
const PRODUCTS_COL = "sku";

type OrderLine = {
  productId: string;
  productName: string;
  imageUrl: string;
  quantity: number;
  size: string;
  color: string;
  unitAmount: number;
  lineAmount: number;
};

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseOrderLines(value: unknown): OrderLine[] {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): OrderLine[] => {
      if (!isRecord(entry)) return [];
      const productId = String(entry.productId ?? "").trim();
      if (!productId) return [];

      return [{
        productId,
        productName: String(entry.productName ?? "Product"),
        imageUrl: String(entry.imageUrl ?? ""),
        quantity: Math.max(1, Math.trunc(toNumber(entry.quantity))),
        size: String(entry.size ?? ""),
        color: String(entry.color ?? ""),
        unitAmount: toNumber(entry.unitAmount),
        lineAmount: toNumber(entry.lineAmount),
      }];
    });
  } catch {
    return [];
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await getUserFromJwt(token);
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    const result = await databases.listDocuments(databaseId, NOTIFICATIONS_COL, [
      Query.equal("userId", user.$id),
      Query.orderDesc("sentAt"),
      Query.limit(20),
    ]);

    const baseNotifications = result.documents.map((doc) => ({
        id: doc.$id,
        title: String(doc.title ?? ""),
        body: String(doc.body ?? ""),
        type: String(doc.type ?? ""),
        isRead: Boolean(doc.isRead),
        sentAt: String(doc.sentAt ?? doc.$createdAt ?? ""),
        metadata: parseMetadata(doc.metadata),
    }));
    const orderIds = [...new Set(baseNotifications
      .map((notification) => String(notification.metadata.orderId ?? "").trim())
      .filter(Boolean))];
    const ordersResult = orderIds.length > 0
      ? await databases.listDocuments(databaseId, ORDERS_COL, [
          Query.equal("$id", orderIds),
          Query.limit(orderIds.length),
        ])
      : { documents: [] };
    const orders = ordersResult.documents
      .filter((order) => String(order.userId ?? "") === user.$id)
      .map((order) => ({
        id: order.$id,
        orderNumber: String(order.orderNumber ?? order.$id),
        totalAmount: toNumber(order.totalAmount),
        items: parseOrderLines(order.itemsJson),
      }));
    const productIds = [...new Set(orders.flatMap((order) => order.items.map((item) => item.productId)))];
    const productsResult = productIds.length > 0
      ? await databases.listDocuments(databaseId, PRODUCTS_COL, [
          Query.equal("$id", productIds),
          Query.limit(productIds.length),
        ])
      : { documents: [] };
    const productImages = new Map(productsResult.documents.map((product) => [
      product.$id,
      String(product.mainImageUrl ?? product.mainImage ?? ""),
    ]));
    const orderById = new Map(orders.map((order) => [
      order.id,
      {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        items: order.items.map((item) => ({
          ...item,
          imageUrl: item.imageUrl || productImages.get(item.productId) || "",
        })),
      },
    ]));

    return NextResponse.json({
      notifications: baseNotifications.map((notification) => ({
        ...notification,
        order: orderById.get(String(notification.metadata.orderId ?? "")) ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await getUserFromJwt(token);
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const payload: unknown = await request.json();
    const body = isRecord(payload) ? payload : {};

    if (body.all) {
      const result = await databases.listDocuments(databaseId, NOTIFICATIONS_COL, [
        Query.equal("userId", user.$id),
        Query.equal("isRead", false),
        Query.limit(50),
      ]);
      await Promise.all(
        result.documents.map((doc) =>
          databases.updateDocument(databaseId, NOTIFICATIONS_COL, doc.$id, { isRead: true })
        )
      );
    } else if (typeof body.id === "string" && body.id.trim()) {
      const notificationId = body.id.trim();
      const doc = await databases.getDocument(databaseId, NOTIFICATIONS_COL, notificationId);
      if (String(doc.userId) !== user.$id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await databases.updateDocument(databaseId, NOTIFICATIONS_COL, notificationId, { isRead: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
