import React from 'react';
import Link from 'next/link';

/** A banner is one link: in-app paths use the router, other URLs a plain anchor; no link renders a plain block. */
export default function BannerLink({ href, className, children }) {
  if (!href) return <div className={className}>{children}</div>;
  if (href.startsWith('/')) {
    return <Link href={href} className={className}>{children}</Link>;
  }
  return <a href={href} className={className}>{children}</a>;
}
