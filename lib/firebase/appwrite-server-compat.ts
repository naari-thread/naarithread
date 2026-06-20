/* eslint-disable @typescript-eslint/no-namespace */
import {
  FieldPath,
  FieldValue,
  type DocumentData,
  type Firestore,
  type Query as FirestoreQuery,
} from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/firebase/admin";
import { appwriteFieldToFirestore, resolveFirestoreCollection } from "@/lib/firebase/collection-map";
import { sanitizeWritePayload, withDocumentMeta } from "@/lib/firebase/document";
import {
  ID,
  Permission,
  Query,
  Role,
  parseQuerySpecs,
  type QuerySpec,
} from "@/lib/firebase/appwrite-query-compat";

export { ID, Permission, Query, Role };

export namespace Models {
  export type Preferences = Record<string, unknown>;
  export type Document = Record<string, unknown> & {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
  };
  export type DefaultDocument = Document;
  export type DocumentList<T extends Document = Document> = {
    total: number;
    documents: T[];
  };
  export type User<TPreferences = Preferences> = {
    $id: string;
    email: string;
    name: string;
    prefs?: TPreferences;
  };
}

type FirebaseOrderDirection = "asc" | "desc";

export class Client {
  setEndpoint(..._args: unknown[]): this {
    void _args;
    return this;
  }

  setProject(..._args: unknown[]): this {
    void _args;
    return this;
  }

  setKey(..._args: unknown[]): this {
    void _args;
    return this;
  }

  setJWT(..._args: unknown[]): this {
    void _args;
    return this;
  }
}

function toDocument<T extends Models.Document>(id: string, data: DocumentData): T {
  return withDocumentMeta(id, data as Record<string, unknown>) as T;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function getLimit(specs: QuerySpec[]): number | null {
  const value = specs.find((spec) => spec.op === "limit")?.value;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : null;
}

function getOffset(specs: QuerySpec[]): number {
  const value = specs.find((spec) => spec.op === "offset")?.value;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function fieldRef(field: string): string | FieldPath {
  const mapped = appwriteFieldToFirestore(field);
  return mapped === "__name__" ? FieldPath.documentId() : mapped;
}

function applyOrder(queryRef: FirestoreQuery, field: string, direction: FirebaseOrderDirection): FirestoreQuery {
  return queryRef.orderBy(fieldRef(field), direction);
}

function applyScalarFilter(queryRef: FirestoreQuery, spec: QuerySpec): FirestoreQuery {
  if (!spec.field) return queryRef;
  const ref = fieldRef(spec.field);
  switch (spec.op) {
    case "equal": {
      const values = asArray(spec.value).filter((value) => typeof value !== "undefined");
      if (values.length === 0) return queryRef;
      return values.length === 1 ? queryRef.where(ref, "==", values[0]) : queryRef.where(ref, "in", values.slice(0, 30));
    }
    case "notEqual":
      return queryRef.where(ref, "!=", spec.value);
    case "lessThan":
      return queryRef.where(ref, "<", spec.value);
    case "lessThanEqual":
      return queryRef.where(ref, "<=", spec.value);
    case "greaterThan":
      return queryRef.where(ref, ">", spec.value);
    case "greaterThanEqual":
      return queryRef.where(ref, ">=", spec.value);
    case "isNotNull":
      return queryRef.where(ref, "!=", null);
    default:
      return queryRef;
  }
}

function buildQuery(db: Firestore, collectionId: string, specs: QuerySpec[]): FirestoreQuery {
  let queryRef: FirestoreQuery = db.collection(resolveFirestoreCollection(collectionId));

  for (const spec of specs) {
    if (["equal", "notEqual", "lessThan", "lessThanEqual", "greaterThan", "greaterThanEqual", "isNotNull"].includes(spec.op)) {
      queryRef = applyScalarFilter(queryRef, spec);
    }
  }

  for (const spec of specs) {
    if (spec.op === "orderAsc" && spec.field) queryRef = applyOrder(queryRef, spec.field, "asc");
    if (spec.op === "orderDesc" && spec.field) queryRef = applyOrder(queryRef, spec.field, "desc");
  }

  const offset = getOffset(specs);
  if (offset > 0) queryRef = queryRef.offset(offset);

  const limit = getLimit(specs);
  if (limit) queryRef = queryRef.limit(limit);

  return queryRef;
}

async function countDocuments(db: Firestore, collectionId: string, specs: QuerySpec[]): Promise<number> {
  const countSpecs = specs.filter((spec) => spec.op !== "limit" && spec.op !== "offset");
  const snapshot = await buildQuery(db, collectionId, countSpecs).count().get();
  return snapshot.data().count;
}

export class Databases {
  private readonly db: Firestore;

  constructor(_client?: Client | null) {
    void _client;
    this.db = getAdminDb();
  }

  async list(): Promise<{ databases: Array<{ $id: string; name: string }> }> {
    return {
      databases: [{ $id: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "naarithread", name: "naarithread" }],
    };
  }

  async getCollection(_databaseId: string, collectionId: string): Promise<{ $id: string; attributes: Array<{ key: string; elements?: string[] }> }> {
    const mapped = resolveFirestoreCollection(collectionId);
    const snapshot = await this.db.collection(mapped).limit(200).get();
    const values = new Map<string, Set<string>>();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      for (const key of ["category", "subcategory", "subCategory", "size"]) {
        const value = data[key];
        if (typeof value === "string" && value.trim()) {
          if (!values.has(key)) values.set(key, new Set());
          values.get(key)?.add(value.trim());
        }
      }
      if (Array.isArray(data.sizeOptions)) {
        if (!values.has("size")) values.set("size", new Set());
        for (const item of data.sizeOptions) {
          if (typeof item === "string" && item.trim()) values.get("size")?.add(item.trim());
        }
      }
    }

    return {
      $id: mapped,
      attributes: Array.from(values.entries()).map(([key, items]) => ({ key, elements: Array.from(items).sort() })),
    };
  }

  async listAttributes(databaseId: string, collectionId: string): Promise<{ attributes: Array<{ key: string; elements?: string[] }> }> {
    const collection = await this.getCollection(databaseId, collectionId);
    return { attributes: collection.attributes };
  }

  async listIndexes(): Promise<{ indexes: unknown[] }> {
    return { indexes: [] };
  }

  async listDocuments<T extends Models.Document = Models.Document>(
    _databaseId: string,
    collectionId: string,
    queries: unknown[] = []
  ): Promise<Models.DocumentList<T>> {
    const specs = parseQuerySpecs(queries);
    const equalArraySpec = specs.find((spec) => spec.op === "equal" && Array.isArray(spec.value) && spec.value.length > 30);

    if (equalArraySpec?.field) {
      const values = asArray(equalArraySpec.value);
      const documents: T[] = [];
      for (let index = 0; index < values.length; index += 30) {
        const chunkSpecs = specs.map((spec) => spec === equalArraySpec ? { ...spec, value: values.slice(index, index + 30) } : spec);
        const chunk = await this.listDocuments<T>(_databaseId, collectionId, chunkSpecs);
        documents.push(...chunk.documents);
      }
      return { total: documents.length, documents };
    }

    const [snapshot, total] = await Promise.all([
      buildQuery(this.db, collectionId, specs).get(),
      countDocuments(this.db, collectionId, specs).catch(() => 0),
    ]);
    return {
      total,
      documents: snapshot.docs.map((doc) => toDocument<T>(doc.id, doc.data())),
    };
  }

  async getDocument<T extends Models.Document = Models.Document>(
    _databaseId: string,
    collectionId: string,
    documentId: string
  ): Promise<T> {
    const snapshot = await this.db.collection(resolveFirestoreCollection(collectionId)).doc(documentId).get();
    if (!snapshot.exists) {
      throw Object.assign(new Error("Document not found."), { code: 404 });
    }
    return toDocument<T>(snapshot.id, snapshot.data() ?? {});
  }

  async createDocument<T extends Models.Document = Models.Document>(
    _databaseId: string,
    collectionId: string,
    documentId: string,
    payload: Record<string, unknown>,
    _permissions?: string[]
  ): Promise<T> {
    void _permissions;
    const ref = this.db.collection(resolveFirestoreCollection(collectionId)).doc(documentId === "unique()" ? ID.unique() : documentId);
    const now = FieldValue.serverTimestamp();
    await ref.set({
      ...sanitizeWritePayload(payload),
      createdAt: now,
      updatedAt: now,
    });
    const snapshot = await ref.get();
    return toDocument<T>(snapshot.id, snapshot.data() ?? {});
  }

  async updateDocument<T extends Models.Document = Models.Document>(
    _databaseId: string,
    collectionId: string,
    documentId: string,
    payload: Record<string, unknown>
  ): Promise<T> {
    const ref = this.db.collection(resolveFirestoreCollection(collectionId)).doc(documentId);
    await ref.set(
      {
        ...sanitizeWritePayload(payload),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    const snapshot = await ref.get();
    return toDocument<T>(snapshot.id, snapshot.data() ?? {});
  }

  async deleteDocument(_databaseId: string, collectionId: string, documentId: string): Promise<void> {
    await this.db.collection(resolveFirestoreCollection(collectionId)).doc(documentId).delete();
  }
}

export class Account {
  async get(): Promise<Models.User> {
    throw new Error("Use Firebase Auth ID tokens with verifyFirebaseIdToken on the server.");
  }
}
