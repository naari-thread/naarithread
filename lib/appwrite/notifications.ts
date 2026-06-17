import { ID, Permission, Role } from "node-appwrite";
import { createDatabasesWithApiKey, getDatabaseId } from "./admin-server";

const NOTIFICATIONS_COL = "notifications";

export async function createUserNotification({
  userId,
  title,
  body,
  type,
  metadata,
}: {
  userId: string;
  title: string;
  body: string;
  type: string;
  metadata?: Record<string, unknown>;
}) {
  const databases = createDatabasesWithApiKey();
  const databaseId = getDatabaseId();

  await databases.createDocument(
    databaseId,
    NOTIFICATIONS_COL,
    ID.unique(),
    {
      userId,
      title,
      body,
      type,
      isRead: false,
      ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
      sentAt: new Date().toISOString(),
    },
    [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
    ]
  );
}
