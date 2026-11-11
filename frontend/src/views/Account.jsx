'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Package, MapPin, Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import ProfileTab from '@/components/account/ProfileTab';
import AddressesTab from '@/components/account/AddressesTab';
import OrdersTab from '@/components/account/OrdersTab';
import NotificationsTab from '@/components/account/NotificationsTab';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'profile', label: 'اطلاعات حساب', icon: User, component: ProfileTab },
  { id: 'orders', label: 'سفارش‌های من', icon: Package, component: OrdersTab },
  { id: 'addresses', label: 'آدرس‌های من', icon: MapPin, component: AddressesTab },
  { id: 'notifications', label: 'اعلان‌ها', icon: Bell, component: NotificationsTab },
];

export default function Account() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = TABS.find((t) => t.id === searchParams.get('tab')) || TABS[0];
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');

  // Leave the customer-only route first so the guard does not bounce to /login.
  const signOut = () => {
    router.replace('/');
    logout();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground md:text-2xl">حساب کاربری</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fullName || 'کاربر گرامی'} — <span dir="ltr">{user.username}</span>
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <div className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => router.replace(`/account?tab=${t.id}`, { scroll: false })}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition',
                  active.id === t.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                )}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
            <button onClick={signOut} className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/5">
              <LogOut className="h-4 w-4" /> خروج
            </button>
          </div>
        </aside>
        <div className="lg:col-span-3">
          <active.component />
        </div>
      </div>
    </div>
  );
}
