'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as cartApi from '@/api/cart';
import { useAuth } from '@/lib/AuthContext';

const CartContext = createContext(null);
const EMPTY = { items: [], subtotal: '0', warnings: [] };

/**
 * The backend cart (session cart for guests, saved cart for customers; merged on login). Lines are addressed by
 * variant id; every change returns the revalidated cart with per-line ``warnings``.
 */
export function CartProvider({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [isOpen, setIsOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setCart(await cartApi.getCart());
    } catch {
      setCart(EMPTY);
    }
  }, []);

  // Reload when the session changes (login merges the guest cart, logout returns to the session cart).
  useEffect(() => {
    if (!isLoadingAuth) refresh();
  }, [user?.id, isLoadingAuth, refresh]);

  useEffect(() => {
    cart.warnings?.forEach((warning) => toast.warning(warning));
  }, [cart.warnings]);

  const run = useCallback(async (call) => {
    try {
      const next = await call();
      if (next) setCart(next);
      else await refresh();
      return true;
    } catch (error) {
      toast.error(error.messages?.[0] || 'خطا در به‌روزرسانی سبد خرید');
      return false;
    }
  }, [refresh]);

  const addItem = useCallback(
    async (variantId, quantity, { silent = false } = {}) => {
      const added = await run(() => cartApi.addCartItem(variantId, quantity));
      if (added && !silent) setIsOpen(true);
      return added;
    },
    [run],
  );
  const updateQuantity = useCallback(
    (variantId, quantity) => run(() => cartApi.setCartItemQuantity(variantId, quantity)),
    [run],
  );
  const removeItem = useCallback((variantId) => run(() => cartApi.removeCartItem(variantId)), [run]);
  const clearCart = useCallback(() => run(() => cartApi.clearCart()), [run]);

  const count = cart.items.length;
  const subtotal = Number(cart.subtotal);

  return (
    <CartContext.Provider
      value={{ items: cart.items, count, subtotal, isOpen, setIsOpen, addItem, updateQuantity, removeItem, clearCart, refresh }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
