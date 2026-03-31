"use client";

import Image, { type ImageProps } from "next/image";

import {
  createCloudinaryLoader,
  isCloudinaryUrl,
  type CloudinaryTransformOptions,
} from "@/lib/cloudinary";

type CloudinaryImageProps = ImageProps & {
  cloudinaryOptions?: Omit<CloudinaryTransformOptions, "width" | "quality">;
};

const FALLBACK_IMAGE_SRC = "/logo4.png";

function isValidNextImageSrc(src: string) {
  if (!src) {
    return false;
  }

  return (
    src.startsWith("/") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:image/") ||
    src.startsWith("blob:")
  );
}

function resolveImageSrc(src: ImageProps["src"]): string {
  if (typeof src === "string") {
    return src;
  }

  if ("src" in src && typeof src.src === "string") {
    return src.src;
  }

  if ("default" in src && src.default && typeof src.default === "object" && "src" in src.default) {
    return src.default.src;
  }

  return "";
}

export function CloudinaryImage({
  src,
  alt,
  cloudinaryOptions,
  className,
  ...props
}: CloudinaryImageProps) {
  const normalizedSrc = resolveImageSrc(src);

  if (!isValidNextImageSrc(normalizedSrc)) {
    return <Image src={FALLBACK_IMAGE_SRC} alt={alt} className={className} {...props} />;
  }

  if (!isCloudinaryUrl(normalizedSrc)) {
    return <Image src={normalizedSrc} alt={alt} className={className} {...props} />;
  }

  return (
    <Image
      src={normalizedSrc}
      alt={alt}
      loader={createCloudinaryLoader(cloudinaryOptions)}
      className={className}
      {...props}
    />
  );
}
