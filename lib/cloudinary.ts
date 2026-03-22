import type { ImageLoaderProps } from "next/image";

type CloudinaryQuality = number | "auto" | "auto:best" | "auto:good" | "auto:eco";

export type CloudinaryTransformOptions = {
  width?: number;
  quality?: CloudinaryQuality;
  crop?: "fill" | "fit" | "scale" | "crop" | "pad" | "thumb";
  gravity?: "auto" | "face" | "faces" | "center";
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  dpr?: "auto" | number;
};

const CLOUDINARY_HOST = "res.cloudinary.com";

export const CLOUDINARY_SIZES = {
  hero: "(max-width: 640px) 100vw, (max-width: 1024px) 94vw, 50vw",
  story: "(max-width: 1024px) 100vw, 50vw",
  carousel: "(max-width: 768px) 64vw, (max-width: 1200px) 42vw, 34vw",
  card: "(max-width: 768px) 48vw, (max-width: 1280px) 50vw, 25vw",
} as const;

export function isCloudinaryUrl(src: string): boolean {
  if (!src.startsWith("http://") && !src.startsWith("https://")) {
    return false;
  }

  try {
    const parsed = new URL(src);
    return parsed.hostname === CLOUDINARY_HOST && parsed.pathname.includes("/image/upload/");
  } catch {
    return false;
  }
}

export function buildCloudinaryUrl(src: string, options: CloudinaryTransformOptions = {}): string {
  if (!isCloudinaryUrl(src)) {
    return src;
  }

  const {
    width,
    quality = "auto",
    crop = "fill",
    gravity = "auto",
    format = "auto",
    dpr = "auto",
  } = options;

  const parsed = new URL(src);
  const uploadMarker = "/upload/";
  const uploadIndex = parsed.pathname.indexOf(uploadMarker);

  if (uploadIndex === -1) {
    return src;
  }

  const beforeUpload = parsed.pathname.slice(0, uploadIndex + uploadMarker.length);
  const afterUpload = parsed.pathname.slice(uploadIndex + uploadMarker.length).replace(/^\/+/, "");

  const transformations = [
    `f_${format}`,
    `q_${quality}`,
    `dpr_${dpr}`,
    `c_${crop}`,
    `g_${gravity}`,
  ];

  if (typeof width === "number" && Number.isFinite(width) && width > 0) {
    transformations.push(`w_${Math.round(width)}`);
  }

  parsed.pathname = `${beforeUpload}${transformations.join(",")}/${afterUpload}`;

  return parsed.toString();
}

export function createCloudinaryLoader(baseOptions: Omit<CloudinaryTransformOptions, "width" | "quality"> = {}) {
  return ({ src, width, quality }: ImageLoaderProps): string => {
    if (!isCloudinaryUrl(src)) {
      return src;
    }

    return buildCloudinaryUrl(src, {
      ...baseOptions,
      width,
      quality: typeof quality === "number" ? quality : "auto",
    });
  };
}
