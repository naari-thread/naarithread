"use client";

import { isExpectedCloudinaryUrl, validateImageFile, type UploadKind } from "@/lib/uploads";

type SignatureResponse = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  uploadPreset?: string;
  signature: string;
  error?: string;
};

/**
 * Uploads a single image directly to Cloudinary using a short-lived signature
 * minted by our server. Returns the Cloudinary `secure_url`.
 *
 * `authToken` is the Appwrite JWT, required for review uploads (user-gated).
 * Product uploads are gated by the admin session cookie and need no token.
 */
export async function uploadImageToCloudinary(
  file: File,
  kind: UploadKind,
  authToken?: string
): Promise<string> {
  const validationError = validateImageFile(file, kind);
  if (validationError) {
    throw new Error(validationError);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const signResponse = await fetch("/api/uploads/sign", {
    method: "POST",
    headers,
    body: JSON.stringify({ kind }),
  });

  const signature = (await signResponse.json()) as SignatureResponse;
  if (!signResponse.ok || !signature.signature) {
    throw new Error(signature.error ?? "Could not authorize image upload.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("folder", signature.folder);
  form.append("signature", signature.signature);
  if (signature.uploadPreset) {
    form.append("upload_preset", signature.uploadPreset);
  }

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    { method: "POST", body: form }
  );

  const result = (await uploadResponse.json().catch(() => ({}))) as {
    secure_url?: string;
    error?: { message?: string };
  };

  if (!uploadResponse.ok || !result.secure_url) {
    throw new Error(result.error?.message ?? "Image upload failed. Please try again.");
  }

  if (!isExpectedCloudinaryUrl(result.secure_url)) {
    throw new Error("Upload returned an unexpected URL.");
  }

  return result.secure_url;
}
