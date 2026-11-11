import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ShoppingCart, Menu, User, LogIn } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/AuthContext';
import { faNum } from '@/lib/format';
import { useInternalPages, useStoreSettings } from '@/hooks/use-site-content';
import ThemeToggle from '@/components/ThemeToggle';
import CategoryMenu from './CategoryMenu';
import { cn } from '@/lib/utils';
import { loginPath, useCurrentPath } from '@/lib/navigation';

/** Store logo (or the first letter of its name) and name, from the store settings. */
export function BrandMark({ settings, showName = true, nameClassName }) {
  const name = settings?.store_name || '';
  return (
    <span className="flex items-center gap-2">
      {settings?.logo_url ? (
        <img src={settings.logo_url} alt={name} className="h-9 w-9 rounded-xl object-contain" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-lg font-bold">{name.charAt(0)}</span>
        </span>
      )}
      {showName && <span className={cn('font-bold text-foreground', nameClassName)}>{name}</span>}
    </span>
  );
}

export default function Header({ onOpenMenu, categories = [] }) {
  const [q, setQ] = useState('');
  const router = useRouter();
  const currentPath = useCurrentPath();
  const { count, setIsOpen } = useCart();
  const { isAuthenticated, user } = useAuth();
  const settings = useStoreSettings();
  const internalPages = useInternalPages();
  const [showSearch, setShowSearch] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setShowSearch(y < lastY || y < 80);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    if (q.trim()) router.push(`/products?search=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:h-[72px]">
        <button onClick={onOpenMenu} className="grid h-10 w-10 place-items-center rounded-xl text-foreground lg:hidden" aria-label="منو">
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/" className="flex items-center">
          <BrandMark settings={settings} nameClassName="hidden sm:inline" />
        </Link>

        <form onSubmit={submitSearch} className="relative mx-auto hidden max-w-xl flex-1 md:block">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی محصول، برند، دسته‌بندی..."
            className="h-11 w-full rounded-xl border border-border bg-muted/50 pr-10 pl-4 text-sm outline-none transition focus:border-primary focus:bg-background"
          />
        </form>

        <div className="mr-auto flex items-center gap-1">
          <ThemeToggle />
          {isAuthenticated ? (
            <Link href="/account" className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-foreground transition hover:bg-muted lg:flex">
              <User className="h-5 w-5" />
              <span>{user.first_name || 'حساب کاربری'}</span>
            </Link>
          ) : (
            <Link href={loginPath(currentPath)} className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-foreground transition hover:bg-muted lg:flex">
              <LogIn className="h-5 w-5" />
              <span>ورود</span>
            </Link>
          )}
          <button
            onClick={() => setIsOpen(true)}
            className="relative grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90"
            aria-label="سبد خرید"
          >
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {faNum(count)}
              </span>
            )}
          </button>
        </div>
      </div>

      <nav className="relative hidden border-t border-border bg-background lg:block">
        {/* The category menu sits outside the scrolling row so its panel is not clipped by overflow-x-auto. */}
        <div className="mx-auto flex max-w-7xl items-center px-4">
          <CategoryMenu categories={categories} />
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${encodeURIComponent(c.slug)}`}
                className="flex shrink-0 items-center gap-1.5 py-3 px-3 text-sm text-muted-foreground transition hover:text-primary"
              >
                {c.icon_url && <img src={c.icon_url} alt="" className="h-4 w-4 object-contain" />}
                {c.name}
              </Link>
            ))}
            <span className="mr-auto" />
            {internalPages.map((p) => (
              <Link key={p.slug} href={`/pages/${encodeURIComponent(p.slug)}`} className="shrink-0 py-3 px-3 text-sm text-muted-foreground transition hover:text-primary">
                {p.title}
              </Link>
            ))}
            <Link href="/blog" className="shrink-0 py-3 px-3 text-sm text-muted-foreground transition hover:text-primary">بلاگ</Link>
            <Link href="/faq" className="shrink-0 py-3 px-3 text-sm text-muted-foreground transition hover:text-primary">سوالات متداول</Link>
            <Link href="/contact" className="shrink-0 py-3 px-3 text-sm text-muted-foreground transition hover:text-primary">تماس با ما</Link>
          </div>
        </div>
      </nav>

      <form onSubmit={submitSearch} className={cn('border-t border-border p-2 transition-all md:hidden', showSearch ? 'block' : 'hidden')}>
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو..."
            className="h-10 w-full rounded-xl border border-border bg-muted/50 pr-10 pl-4 text-sm outline-none focus:border-primary focus:bg-background"
          />
        </div>
      </form>
    </header>
  );
}
