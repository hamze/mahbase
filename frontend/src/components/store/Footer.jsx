import React from 'react';
import Link from 'next/link';
import { Instagram, Send, Phone, MapPin, Mail, MessageCircle, Twitter, Linkedin, Youtube, Video } from 'lucide-react';
import { useInternalPages, useStoreSettings } from '@/hooks/use-site-content';
import { persianDigits, toJalali } from '@/lib/jalali';
import { BrandMark } from './Header';

const SOCIALS = [
  { key: 'instagram', label: 'اینستاگرام', icon: Instagram },
  { key: 'telegram', label: 'تلگرام', icon: Send },
  { key: 'whatsapp', label: 'واتس‌اپ', icon: MessageCircle },
  { key: 'twitter', label: 'توییتر', icon: Twitter },
  { key: 'linkedin', label: 'لینکدین', icon: Linkedin },
  { key: 'youtube', label: 'یوتیوب', icon: Youtube },
  { key: 'aparat', label: 'آپارات', icon: Video },
];

export default function Footer() {
  const settings = useStoreSettings();
  const internalPages = useInternalPages();
  const socials = SOCIALS.filter((s) => settings?.social_links?.[s.key]);
  const year = persianDigits(String(toJalali(new Date()).jy));

  return (
    <footer className="mt-16 border-t border-border bg-card/50">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <BrandMark settings={settings} />
            {settings?.footer_text && (
              <div
                className="mt-4 text-sm leading-7 text-muted-foreground [&_a]:text-primary"
                dangerouslySetInnerHTML={{ __html: settings.footer_text }}
              />
            )}
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold text-foreground">دسترسی سریع</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/products" className="hover:text-primary">همه محصولات</Link></li>
              <li><Link href="/blog" className="hover:text-primary">بلاگ</Link></li>
              <li><Link href="/faq" className="hover:text-primary">سوالات متداول</Link></li>
              <li><Link href="/contact" className="hover:text-primary">تماس با ما</Link></li>
            </ul>
          </div>

          {internalPages.length > 0 && (
            <div>
              <h4 className="mb-4 text-sm font-bold text-foreground">اطلاعات</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {internalPages.map((p) => (
                  <li key={p.slug}><Link href={`/pages/${encodeURIComponent(p.slug)}`} className="hover:text-primary">{p.title}</Link></li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="mb-4 text-sm font-bold text-foreground">ارتباط با ما</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {settings?.contact_phone && (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={`tel:${settings.contact_phone}`} dir="ltr" className="hover:text-primary">{persianDigits(settings.contact_phone)}</a>
                </li>
              )}
              {settings?.contact_email && (
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${settings.contact_email}`} className="hover:text-primary">{settings.contact_email}</a>
                </li>
              )}
              {settings?.address && <li className="flex items-start gap-2"><MapPin className="mt-1 h-4 w-4 shrink-0" /> {settings.address}</li>}
            </ul>
            {socials.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={settings.social_links[s.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:text-primary"
                  >
                    <s.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">© {year} {settings?.store_name}. تمامی حقوق محفوظ است.</p>
          {settings?.trust_badges?.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {settings.trust_badges.map((badge, i) => {
                const image = <img src={badge.image_url} alt="نماد اعتماد" className="h-16 w-auto rounded-lg border border-border bg-background object-contain p-1" />;
                return badge.link_url ? (
                  <a key={i} href={badge.link_url} target="_blank" rel="noopener noreferrer">{image}</a>
                ) : (
                  <span key={i}>{image}</span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
