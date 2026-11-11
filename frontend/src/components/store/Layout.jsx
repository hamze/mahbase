'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { X, Home as HomeIcon, Search, ShoppingCart, User, LogIn } from 'lucide-react';
import { bannersQuery, categoriesQuery } from '@/api/queries';
import { useAuth } from '@/lib/AuthContext';
import { useInternalPages, useStoreSettings } from '@/hooks/use-site-content';
import { loginPath, useCurrentPath } from '@/lib/navigation';
import Header, { BrandMark } from './Header';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import CartBar from './CartBar';
import BannerLink from './BannerLink';

/** Thin TOP_HEADER banner above the header; the whole strip is the link. */
function TopBanner() {
  const { data: banners = [] } = useQuery(bannersQuery('TOP_HEADER'));
  const banner = banners[0];
  if (!banner) return null;
  const body = banner.image_url ? (
    <img src={banner.image_url} alt={banner.title} className="mx-auto max-h-14 w-full object-cover" />
  ) : (
    <div className="px-4 py-2 text-center text-xs font-medium sm:text-sm">
      {banner.title}
      {banner.subtitle && <span className="mr-2 opacity-80">{banner.subtitle}</span>}
    </div>
  );
  return <BannerLink href={banner.link_url} className="block bg-primary text-primary-foreground">{body}</BannerLink>;
}

function MobileMenu({ open, onClose, categories }) {
  const settings = useStoreSettings();
  const internalPages = useInternalPages();
  const { isAuthenticated } = useAuth();
  const currentPath = useCurrentPath();
  if (!open) return null;
  const linkCls = 'block py-2.5 text-sm text-muted-foreground hover:text-primary';
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-[85%] max-w-xs flex-col bg-background shadow-xl animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-border p-4">
          <BrandMark settings={settings} />
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="بستن"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <Link href="/products" onClick={onClose} className="block py-2.5 font-medium text-foreground hover:text-primary">همه محصولات</Link>
          {categories.map((c) => (
            <div key={c.id}>
              <Link href={`/products?category=${encodeURIComponent(c.slug)}`} onClick={onClose} className="flex items-center gap-2 py-2.5 text-sm text-foreground hover:text-primary">
                {c.icon_url && <img src={c.icon_url} alt="" className="h-4 w-4 object-contain" />}
                {c.name}
              </Link>
              {(c.children || []).map((child) => (
                <Link key={child.id} href={`/products?category=${encodeURIComponent(child.slug)}`} onClick={onClose} className="mr-6 block border-r border-border py-2 pr-3 text-sm text-muted-foreground hover:text-primary">
                  {child.name}
                </Link>
              ))}
            </div>
          ))}
          <div className="my-3 border-t border-border" />
          {internalPages.map((p) => (
            <Link key={p.slug} href={`/pages/${encodeURIComponent(p.slug)}`} onClick={onClose} className={linkCls}>{p.title}</Link>
          ))}
          <Link href="/blog" onClick={onClose} className={linkCls}>بلاگ</Link>
          <Link href="/faq" onClick={onClose} className={linkCls}>سوالات متداول</Link>
          <Link href="/contact" onClick={onClose} className={linkCls}>تماس با ما</Link>
          {isAuthenticated ? (
            <Link href="/account" onClick={onClose} className={linkCls}>حساب کاربری</Link>
          ) : (
            <Link href={loginPath(currentPath)} onClick={onClose} className={linkCls}>ورود</Link>
          )}
        </nav>
      </aside>
    </div>
  );
}

function MobileBottomNav() {
  const { isAuthenticated } = useAuth();
  const currentPath = useCurrentPath();
  const itemCls = 'flex flex-col items-center gap-1 py-2.5 text-muted-foreground hover:text-primary';
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background/90 backdrop-blur-md lg:hidden">
      <Link href="/" className={itemCls}>
        <HomeIcon className="h-5 w-5" /><span className="text-[10px]">خانه</span>
      </Link>
      <Link href="/products" className={itemCls}>
        <Search className="h-5 w-5" /><span className="text-[10px]">محصولات</span>
      </Link>
      <Link href="/cart" className={itemCls}>
        <ShoppingCart className="h-5 w-5" /><span className="text-[10px]">سبد</span>
      </Link>
      {isAuthenticated ? (
        <Link href="/account" className={itemCls}>
          <User className="h-5 w-5" /><span className="text-[10px]">حساب</span>
        </Link>
      ) : (
        <Link href={loginPath(currentPath)} className={itemCls}>
          <LogIn className="h-5 w-5" /><span className="text-[10px]">ورود</span>
        </Link>
      )}
    </nav>
  );
}

/** Store shell around every page except login: banner, header, footer, cart drawer and the mobile bars. */
export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: categories = [] } = useQuery(categoriesQuery());
  const pathname = usePathname();
  const isCart = pathname === '/cart';

  return (
    <div className="flex min-h-screen flex-col bg-background pb-16 lg:pb-0">
      <TopBanner />
      <Header onOpenMenu={() => setMenuOpen(true)} categories={categories} />
      <main className="flex-1">
        {children}
      </main>
      {isCart ? <div className="hidden lg:block"><Footer /></div> : <Footer />}
      {!isCart && <CartBar />}
      {!isCart && <MobileBottomNav />}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} categories={categories} />
      <CartDrawer />
    </div>
  );
}
