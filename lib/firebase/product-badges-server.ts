import { getAdminDb } from "@/lib/firebase/admin";

const COLLECTION = "productBadges";

export type CustomBadge = { value: string; label: string };

function labelToValue(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listCustomBadges(): Promise<CustomBadge[]> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTION).limit(100).get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as Partial<{ value: string; label: string }>;
      return {
        value: String(data.value ?? doc.id).trim(),
        label: String(data.label ?? "").trim(),
      };
    })
    .filter((b) => b.value && b.label);
}

export async function createCustomBadge(label: string): Promise<CustomBadge> {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) throw new Error("Badge label is required.");

  const value = labelToValue(trimmedLabel);
  if (!value) throw new Error("Badge label produces an invalid slug.");

  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(value);
  const existing = await ref.get();

  if (existing.exists) {
    const data = existing.data() as Partial<{ label: string }>;
    return { value, label: String(data.label ?? trimmedLabel) };
  }

  const badge: { value: string; label: string; createdAt: string } = {
    value,
    label: trimmedLabel,
    createdAt: new Date().toISOString(),
  };

  await ref.set(badge);
  return { value, label: trimmedLabel };
}
