import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { readStorage, writeStorage } from '../lib/storage';
import type { CartItem, Product } from '../types';

type CartContextValue = {
  items: CartItem[];
  storageError: boolean;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const storageKey = 'shopflow_cart';

function loadCart(): CartItem[] {
  try {
    const stored = JSON.parse(readStorage(storageKey) || 'null');
    const raw = Array.isArray(stored) ? stored : stored?.version === 1 ? stored.items : [];
    if (!Array.isArray(raw)) return [];
    const seen = new Set<number>();
    return raw.filter((item): item is CartItem => {
      const p = item?.product;
      if (!p || !Number.isSafeInteger(p.id) || p.id < 1 || seen.has(p.id) ||
          !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000 ||
          !Number.isSafeInteger(p.stock) || p.stock < item.quantity ||
          !Number.isFinite(p.price) || p.price <= 0 || p.price > 1000000 ||
          !['name', 'slug', 'description', 'imageUrl'].every((k) => typeof p[k] === 'string') ||
          !p.category || typeof p.category.name !== 'string') return false;
      seen.add(p.id);
      return true;
    });
  } catch { return []; }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    setStorageError(!writeStorage(storageKey, JSON.stringify({ version: 1, items })));
  }, [items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    storageError,
    addItem(product, quantity = 1) {
      if (!Number.isSafeInteger(quantity) || quantity < 1 || product.stock < 1) return;
      setItems((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
              : item,
          );
        }
        return [...prev, { product, quantity: Math.min(quantity, product.stock) }];
      });
    },
    removeItem(productId) {
      setItems((prev) => prev.filter((item) => item.product.id !== productId));
    },
    updateQuantity(productId, quantity) {
      if (!Number.isSafeInteger(quantity)) return;
      setItems((prev) =>
        prev
          .map((item) =>
            item.product.id === productId
              ? { ...item, quantity: Math.max(1, Math.min(quantity, item.product.stock)) }
              : item,
          )
          .filter((item) => item.quantity > 0),
      );
    },
    clear() {
      setItems([]);
    },
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + Math.round(item.product.price * 100) * item.quantity, 0) / 100,
  }), [items, storageError]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
