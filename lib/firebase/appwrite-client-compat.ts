/* eslint-disable @typescript-eslint/no-namespace */
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Query as FirestoreQuery,
  type QueryConstraint,
} from "firebase/firestore";

import { resolveFirestoreCollection } from "@/lib/firebase/collection-map";
import { getFirebaseDb } from "@/lib/firebase/config";
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

export enum OAuthProvider {
  Google = "google.com",
}

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

export class Client {
  setEndpoint(..._args: unknown[]): this {
    void _args;
    return this;
  }

  setProject(..._args: unknown[]): this {
    void _args;
    return this;
  }

  setJWT(..._args: unknown[]): this {
    void _args;
    return this;
  }
}

function queryField(field: string): string | ReturnType<typeof documentId> {
  if (field === "$id") return documentId();
  if (field === "$createdAt") return "createdAt";
  if (field === "$updatedAt") return "updatedAt";
  return field;
}

function buildConstraints(specs: QuerySpec[]): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  for (const spec of specs) {
    if (!spec.field) continue;
    const ref = queryField(spec.field);
    switch (spec.op) {
      case "equal": {
        const values = Array.isArray(spec.value) ? spec.value : [spec.value];
        if (values.length === 1) constraints.push(where(ref, "==", values[0]));
        else if (values.length > 1) constraints.push(where(ref, "in", values.slice(0, 30)));
        break;
      }
      case "notEqual":
        constraints.push(where(ref, "!=", spec.value));
        break;
      case "lessThan":
        constraints.push(where(ref, "<", spec.value));
        break;
      case "lessThanEqual":
        constraints.push(where(ref, "<=", spec.value));
        break;
      case "greaterThan":
        constraints.push(where(ref, ">", spec.value));
        break;
      case "greaterThanEqual":
        constraints.push(where(ref, ">=", spec.value));
        break;
      case "isNotNull":
        constraints.push(where(ref, "!=", null));
        break;
      default:
        break;
    }
  }

  for (const spec of specs) {
    if (spec.op === "orderAsc" && spec.field) constraints.push(orderBy(queryField(spec.field), "asc"));
    if (spec.op === "orderDesc" && spec.field) constraints.push(orderBy(queryField(spec.field), "desc"));
  }

  const limitValue = specs.find((spec) => spec.op === "limit")?.value;
  const parsedLimit = Number(limitValue);
  if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
    constraints.push(limit(Math.trunc(parsedLimit)));
  }

  return constraints;
}

function toDocument<T extends Models.Document>(id: string, data: Record<string, unknown>): T {
  return withDocumentMeta(id, data) as T;
}

export class Databases {
  private readonly db: Firestore;

  constructor(_client?: Client | null) {
    void _client;
    this.db = getFirebaseDb();
  }

  async listDocuments<T extends Models.Document = Models.Document>(
    _databaseId: string,
    collectionId: string,
    queries: unknown[] = []
  ): Promise<Models.DocumentList<T>> {
    const mapped = resolveFirestoreCollection(collectionId);
    const specs = parseQuerySpecs(queries);
    const equalArraySpec = specs.find((spec) => spec.op === "equal" && Array.isArray(spec.value) && spec.value.length > 30);

    if (equalArraySpec) {
      const values = equalArraySpec.value as unknown[];
      const documents: T[] = [];
      for (let index = 0; index < values.length; index += 30) {
        const chunkSpecs = specs.map((spec) => spec === equalArraySpec ? { ...spec, value: values.slice(index, index + 30) } : spec);
        const chunk = await this.listDocuments<T>(_databaseId, collectionId, chunkSpecs);
        documents.push(...chunk.documents);
      }
      return { total: documents.length, documents };
    }

    const ref = collection(this.db, mapped);
    const q = query(ref, ...buildConstraints(specs)) as FirestoreQuery;
    const snapshot = await getDocs(q);
    let documents = snapshot.docs.map((item) => toDocument<T>(item.id, item.data() as Record<string, unknown>));

    const offsetValue = Number(specs.find((spec) => spec.op === "offset")?.value ?? 0);
    if (Number.isFinite(offsetValue) && offsetValue > 0) {
      documents = documents.slice(Math.trunc(offsetValue));
    }

    return { total: documents.length, documents };
  }

  async getDocument<T extends Models.Document = Models.Document>(
    _databaseId: string,
    collectionId: string,
    documentIdValue: string
  ): Promise<T> {
    const snapshot = await getDoc(doc(this.db, resolveFirestoreCollection(collectionId), documentIdValue));
    if (!snapshot.exists()) {
      throw Object.assign(new Error("Document not found."), { code: 404 });
    }
    return toDocument<T>(snapshot.id, snapshot.data() as Record<string, unknown>);
  }

  async createDocument<T extends Models.Document = Models.Document>(
    _databaseId: string,
    collectionId: string,
    documentIdValue: string,
    payload: Record<string, unknown>,
    _permissions?: string[]
  ): Promise<T> {
    void _permissions;
    const id = documentIdValue === "unique()" ? ID.unique() : documentIdValue;
    const ref = doc(this.db, resolveFirestoreCollection(collectionId), id);
    await setDoc(ref, {
      ...sanitizeWritePayload(payload),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return this.getDocument<T>(_databaseId, collectionId, id);
  }

  async updateDocument<T extends Models.Document = Models.Document>(
    _databaseId: string,
    collectionId: string,
    documentIdValue: string,
    payload: Record<string, unknown>
  ): Promise<T> {
    const ref = doc(this.db, resolveFirestoreCollection(collectionId), documentIdValue);
    await updateDoc(ref, {
      ...sanitizeWritePayload(payload),
      updatedAt: serverTimestamp(),
    });
    return this.getDocument<T>(_databaseId, collectionId, documentIdValue);
  }

  async deleteDocument(
    _databaseId: string,
    collectionId: string,
    documentIdValue: string
  ): Promise<void> {
    await deleteDoc(doc(this.db, resolveFirestoreCollection(collectionId), documentIdValue));
  }
}

export class Account {}
