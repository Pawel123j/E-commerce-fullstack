import type { CartItem, Product } from '../types';

export const cartStorageKey = 'shopflow_cart';

export type CartState = {
  items: CartItem[];
  warning: string | null;
  memoryOnly: boolean;
  revision: number;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

export function validProduct(value: unknown): value is Product {
  if (!record(value) || !record(value.category)) return false;
  return integer(value.id, 1) && integer(value.categoryId, 1)
    && integer(value.stock, 0) && typeof value.featured === 'boolean'
    && typeof value.price === 'number' && Number.isFinite(value.price) && value.price >= 0
    && Number.isSafeInteger(Math.round(value.price * 100))
    && ['name', 'slug', 'description', 'imageUrl'].every((key) => typeof value[key] === 'string')
    && integer(value.category.id, 1) && value.category.id === value.categoryId
    && typeof value.category.name === 'string' && typeof value.category.slug === 'string';
}

export function validCart(value: unknown): value is CartItem[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<number>();
  let count = 0;
  let cents = 0;
  for (const item of value) {
    if (!record(item) || !validProduct(item.product) || !integer(item.quantity, 1)
      || item.quantity > item.product.stock || ids.has(item.product.id)) return false;
    ids.add(item.product.id);
    count += item.quantity;
    cents += Math.round(item.product.price * 100) * item.quantity;
    if (!Number.isSafeInteger(count) || !Number.isSafeInteger(cents)) return false;
  }
  return true;
}

export function loadCart(): CartState {
  const empty = { items: [], warning: null, memoryOnly: false, revision: 0 };
  let raw: string | null;
  try {
    raw = localStorage.getItem(cartStorageKey);
  } catch {
    return { ...empty, memoryOnly: true, warning: 'Browser storage is unavailable. Your cart works in this tab only and will not be saved.' };
  }
  if (raw === null) return empty;
  try {
    const items: unknown = JSON.parse(raw);
    if (validCart(items)) return { ...empty, items };
  } catch {
    // Keep the original value at its existing key for recovery; do not reset it.
  }
  return {
    ...empty,
    memoryOnly: true,
    warning: 'Your saved cart could not be loaded. The original saved data has been left unchanged. Changes in this tab will not be saved.',
  };
}
