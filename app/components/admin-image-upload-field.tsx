"use client";

import { useId, useRef, useState } from "react";

import { uploadImageToCloudinary } from "@/lib/cloudinary-upload-client";
import { UPLOAD_CONFIG, formatBytes } from "@/lib/uploads";

type AdminImageUploadFieldProps = {
  name: string;
  defaultValue?: string;
  multiple?: boolean;
  label: string;
  required?: boolean;
};

function splitUrls(value: string) {
  return value
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

/**
 * Image upload control for the admin product form. Uploads directly to Cloudinary
 * (admin-gated signature) and writes the resulting URL(s) into a hidden input so
 * the existing server action picks them up via FormData. Click a thumbnail to
 * zoom; click the × to remove.
 */
export function AdminImageUploadField({
  name,
  defaultValue = "",
  multiple = false,
  label,
  required = false,
}: AdminImageUploadFieldProps) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [urls, setUrls] = useState<string[]>(splitUrls(defaultValue));
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const hiddenValue = multiple ? urls.join(", ") : (urls[0] ?? "");
  const maxBytes = UPLOAD_CONFIG.product.maxBytes;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setError("");
    setIsUploading(true);

    try {
      const selected = multiple ? Array.from(files) : [files[0]];
      const uploaded: string[] = [];

      for (const file of selected) {
        const url = await uploadImageToCloudinary(file, "product");
        uploaded.push(url);
      }

      setUrls((current) => (multiple ? [...current, ...uploaded] : uploaded));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const removeUrl = (target: string) => {
    setUrls((current) => current.filter((url) => url !== target));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <input type="hidden" name={name} value={hiddenValue} required={required && urls.length === 0} />

      {urls.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {urls.map((url) => (
            <div
              key={url}
              className="group relative h-24 w-24 overflow-hidden rounded-xl border border-primary/18 bg-paper shadow-sm"
            >
              <button
                type="button"
                onClick={() => setZoomUrl(url)}
                aria-label="Zoom image"
                className="block h-full w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Uploaded preview" className="h-full w-full object-cover transition group-hover:scale-105" />
              </button>
              <button
                type="button"
                onClick={() => removeUrl(url)}
                aria-label="Remove image"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm font-bold text-paper shadow-md transition hover:scale-110"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-lg border border-primary/25 bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary/85 transition hover:border-primary/45"
        >
          {isUploading ? "Uploading…" : multiple ? "Add images" : urls.length > 0 ? "Replace image" : "Upload image"}
        </label>
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          aria-label={`Upload ${label}`}
          accept="image/jpeg,image/png,image/webp"
          multiple={multiple}
          disabled={isUploading}
          onChange={(event) => handleFiles(event.target.files)}
          className="hidden"
        />
        <span className="text-[0.65rem] text-primary/55">JPG/PNG/WebP up to {formatBytes(maxBytes)}</span>
      </div>

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}

      {zoomUrl ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-primary/70 p-4 backdrop-blur-sm"
          onClick={() => setZoomUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div className="relative max-h-[88vh] max-w-3xl" onClick={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoomUrl} alt="Zoomed preview" className="max-h-[88vh] w-auto rounded-2xl object-contain shadow-2xl" />
            <button
              type="button"
              onClick={() => setZoomUrl(null)}
              aria-label="Close preview"
              className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-paper text-lg font-bold text-primary shadow-lg"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
