import { v2 as cloudinary } from "cloudinary";

import { UPLOAD_CONFIG, type UploadKind } from "@/lib/uploads";

function mustEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getCloudinaryConfig() {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME?.trim() || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName) {
    throw new Error("Missing required environment variable: CLOUDINARY_CLOUD_NAME");
  }

  const apiKey = mustEnv("CLOUDINARY_API_KEY");
  const apiSecret = mustEnv("CLOUDINARY_API_SECRET");

  return { cloudName, apiKey, apiSecret };
}

/**
 * Builds the signed parameters a client needs to upload directly to Cloudinary.
 * The file bytes never pass through our server (free-tier friendly); we only mint
 * a short-lived signature scoped to a fixed folder.
 */
export function createUploadSignature(kind: UploadKind) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const folder = UPLOAD_CONFIG[kind].folder;
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = { folder, timestamp };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return {
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature,
  };
}
