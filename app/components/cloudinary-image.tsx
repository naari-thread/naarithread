import Image, { type ImageProps } from "next/image";

import {
  createCloudinaryLoader,
  isCloudinaryUrl,
  type CloudinaryTransformOptions,
} from "@/lib/cloudinary";

type CloudinaryImageProps = ImageProps & {
  cloudinaryOptions?: Omit<CloudinaryTransformOptions, "width" | "quality">;
  revealFromTop?: boolean;
};

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
  revealFromTop = true,
  className,
  ...props
}: CloudinaryImageProps) {
  const normalizedSrc = resolveImageSrc(src);

  if (!isCloudinaryUrl(normalizedSrc)) {
    return <Image src={src} alt={alt} className={className} {...props} />;
  }

  const revealClassName = [className, revealFromTop ? "cloudinary-reveal-down" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <Image
      src={normalizedSrc}
      alt={alt}
      loader={createCloudinaryLoader(cloudinaryOptions)}
      className={revealClassName}
      {...props}
    />
  );
}
