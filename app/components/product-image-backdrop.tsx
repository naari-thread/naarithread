import type { ReactElement } from "react";

import { CloudinaryImage } from "@/app/components/cloudinary-image";

type ProductImageBackdropProps = {
  src: string;
  /** Must match the `sizes` of the foreground image so the browser reuses the same file. */
  sizes: string;
};

/**
 * Blurred, cover-fit copy of a product photo, placed behind an `object-contain`
 * image. Fills the empty space around photos whose shape doesn't match their
 * frame (e.g. square flat-lays in a portrait frame) instead of flat bars.
 * The parent must be `relative` and `overflow-hidden`.
 */
export function ProductImageBackdrop({ src, sizes }: ProductImageBackdropProps): ReactElement {
  return (
    <CloudinaryImage
      src={src}
      alt=""
      aria-hidden={true}
      fill
      sizes={sizes}
      className="pointer-events-none scale-110 object-cover opacity-60 blur-2xl"
    />
  );
}
