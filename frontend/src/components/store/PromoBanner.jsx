import React from 'react';
import { Image } from '@/components/ui/image';
import BannerLink from './BannerLink';

/** SIDEBAR banners; the whole banner is the link. */
export default function PromoBanner({ banners }) {
  if (banners.length === 0) return null;
  return (
    <div className="mx-auto grid max-w-7xl gap-3 px-4 pt-10 sm:grid-cols-2">
      {banners.map((banner) => (
        <BannerLink
          key={banner.id}
          href={banner.link_url}
          className="group relative block h-36 overflow-hidden rounded-2xl border border-border md:h-48"
        >
          <Image src={banner.image_url} alt={banner.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          {(banner.title || banner.subtitle) && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
              {banner.title && <p className="font-bold">{banner.title}</p>}
              {banner.subtitle && <p className="mt-1 text-xs leading-6 text-white/85">{banner.subtitle}</p>}
            </div>
          )}
        </BannerLink>
      ))}
    </div>
  );
}
