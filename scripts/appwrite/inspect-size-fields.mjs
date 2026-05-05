import "dotenv/config";

import { Client, Databases, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "naarithread";

if (!projectId || !apiKey) {
  throw new Error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const attributes = await databases.listAttributes(databaseId, "sku");
const sizeOptionsAttribute = attributes.attributes.find((attribute) => attribute.key === "sizeOptions");

console.log("sizeOptions attribute:",
  sizeOptionsAttribute
    ? {
        key: sizeOptionsAttribute.key,
        type: sizeOptionsAttribute.type,
        array: sizeOptionsAttribute.array,
        status: sizeOptionsAttribute.status,
      }
    : "MISSING"
);

const response = await databases.listDocuments(databaseId, "sku", [
  Query.limit(10),
  Query.orderDesc("$createdAt"),
]);

for (const document of response.documents) {
  console.log(document.$id, {
    size: document.size ?? null,
    sizeOptions: document.sizeOptions ?? null,
  });
}
