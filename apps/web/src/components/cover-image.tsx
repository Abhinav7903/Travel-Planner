"use client";

import { useState, type ReactNode } from "react";

export function CoverImage({
  src,
  alt = "",
  className,
  fallback,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      decoding="async"
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  );
}
