import { useState } from "react";
import { cn } from "@/lib/utils";

/** Lazy image; renders a neutral placeholder when there is no ``src`` or it fails to load. */
function Image({ src, alt = "", className, ...props }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className={cn("bg-muted", className)} role="img" aria-label={alt} />;
  }
  return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} {...props} />;
}

export { Image };
