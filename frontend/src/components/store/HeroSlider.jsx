import React, { useEffect, useState } from 'react';
import { Image } from '@/components/ui/image';
import BannerLink from './BannerLink';
import { cn } from '@/lib/utils';

/** HERO banners as an auto-advancing slider; each slide is a link to its ``link_url``. */
export default function HeroSlider({ banners }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = setInterval(() => setActive((a) => (a + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const slide = banners[Math.min(active, banners.length - 1)];

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
        <BannerLink href={slide.link_url} className="grid md:min-h-[480px] md:grid-cols-2">
          <div className="relative order-1 h-60 overflow-hidden sm:h-80 md:order-2 md:h-full md:min-h-[480px]">
            <Image key={slide.id} src={slide.image_url} alt={slide.title} className="h-full w-full animate-fade-in object-cover" />
          </div>
          <div className="order-2 flex flex-col justify-center gap-4 p-6 md:order-1 md:p-12">
            {slide.title && (
              <h2 className="text-2xl font-bold leading-9 text-foreground md:text-4xl md:leading-[3rem]">{slide.title}</h2>
            )}
            {slide.subtitle && <p className="max-w-md text-sm leading-7 text-muted-foreground md:text-base">{slide.subtitle}</p>}
          </div>
        </BannerLink>

        {banners.length > 1 && (
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                onClick={() => setActive(i)}
                aria-label={`اسلاید ${i + 1}`}
                className={cn('h-2 rounded-full transition-all', i === active ? 'w-6 bg-primary' : 'w-2 bg-foreground/30')}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
