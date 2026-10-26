import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CartItem, Product } from '../types';
import { cartStorageKey, loadCart, validCart, validProduct } from './cartStorage';

type CartContextValue = {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  persistenceWarning: string | null;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(loadCart);
  const savedRevision = useRef(0);
  const { items } = state;

  useEffect(() => {
    if (state.memoryOnly || state.revision === savedRevision.current) return;
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(state.items));
      savedRevision.current = state.revision;
    } catch {
      setState((current) => ({
        ...current,
        memoryOnly: true,
        warning: 'Your cart could not be saved. Changes in this tab will be lost when you close or reload it; the previous saved cart has been left unchanged.',
      }));
    }
  }, [state]);

  function changeItems(update: (previous: CartItem[]) => CartItem[]) {
    setState((current) => {
      const next = update(current.items);
      if (next === current.items || !validCart(next)) return current;
      return { ...current, items: next, revision: current.revision + 1 };
    });
  }

  const value = useMemo<CartContextValue>(() => ({
    items,
    persistenceWarning: state.warning,
    addItem(product, quantity = 1) {
      if (!validProduct(product) || product.stock === 0 || !Number.isSafeInteger(quantity) || quantity <= 0) return;
      changeItems((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id
              ? { product, quantity: Math.min(item.quantity + quantity, product.stock) }
              : item,
          );
        }
        return [...prev, { product, quantity: Math.min(quantity, product.stock) }];
      });
    },
    removeItem(productId) {
      changeItems((prev) => prev.filter((item) => item.product.id !== productId));
    },
    updateQuantity(productId, quantity) {
      if (!Number.isSafeInteger(quantity) || quantity <= 0) return;
      changeItems((prev) =>
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
      changeItems(() => []);
    },
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
  }), [items, state.warning]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
