'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { loginPath, useCurrentPath } from '@/lib/navigation';

/** Customer-only pages: guests go to /login and come back afterwards (``returnTo``). */
export default function RequireCustomer({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const router = useRouter();
  const currentPath = useCurrentPath();
  const isGuest = !isLoadingAuth && !isAuthenticated;

  useEffect(() => {
    if (isGuest) router.replace(loginPath(currentPath));
  }, [isGuest, currentPath, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }
  return children;
}
