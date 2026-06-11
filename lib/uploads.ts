// Shared (client + server) upload constraints for Cloudinary image uploads.
// Keep these in sync with any signed upload preset configured in Cloudinary.

export type UploadKind = "product" | "review";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

export const UPLOAD_CONFIG: Record<
  UploadKind,
  { folder: string; maxBytes: number; maxCount: number }
> = {
  product: { folder: "naarithread/products", maxBytes: 5 * 1024 * 1024, maxCount: 6 },
  review: { folder: "naarithread/reviews", maxBytes: 2 * 1024 * 1024, maxCount: 3 },
};

export function isUploadKind(value: unknown): value is UploadKind {
  return value === "product" || value === "review";
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

/** Client-side validation before requesting a signature. Returns an error string or null. */
export function validateImageFile(file: File, kind: UploadKind): string | null {
  const config = UPLOAD_CONFIG[kind];

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return "Only JPG, PNG, or WebP images are allowed.";
  }

  if (file.size > config.maxBytes) {
    return `Image is too large. Max ${formatBytes(config.maxBytes)}.`;
  }

  return null;
}

/**
 * Confirms a URL is a Cloudinary delivery URL. We intentionally do NOT require the
 * folder to appear in the path: Cloudinary's dynamic-folder mode stores the folder
 * as metadata and generates an unguessable public ID, so the delivery URL often
 * omits the folder. Folder scoping is still enforced server-side via the signed
 * `folder` upload parameter.
 */
export function isExpectedCloudinaryUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.includes("/image/upload/")
    );
  } catch {
    return false;
  }
}
