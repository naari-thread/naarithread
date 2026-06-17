import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";

export const runtime = "nodejs";

const NOTIFICATIONS_COL = "notifications";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

export async function GET(request: Request) {
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

    return NextResponse.json({
      notifications: result.documents.map((doc) => ({
        id: doc.$id,
        title: String(doc.title ?? ""),
        body: String(doc.body ?? ""),
        type: String(doc.type ?? ""),
        isRead: Boolean(doc.isRead),
        sentAt: String(doc.sentAt ?? doc.$createdAt ?? ""),
        metadata: doc.metadata ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await getUserFromJwt(token);
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const body = await request.json() as { id?: string; all?: boolean };

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
    } else if (body.id) {
      const doc = await databases.getDocument(databaseId, NOTIFICATIONS_COL, body.id);
      if (String(doc.userId) !== user.$id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await databases.updateDocument(databaseId, NOTIFICATIONS_COL, body.id, { isRead: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
