export type User = {
  id: number;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
};

export type Category = {
  id: number;
  name: string;
  slug: string;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  imageUrl: string;
  featured: boolean;
  stock: number;
  categoryId: number;
  category: Category;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type OrderItem = {
  id: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
};

export type Order = {
  id: number;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  couponCode?: string | null;
  shippingName: string;
  shippingEmail: string;
  shippingAddress: string;
  createdAt: string;
  items: OrderItem[];
};
