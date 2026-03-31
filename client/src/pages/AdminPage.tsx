import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Category, Order, Product } from '../types';

export function AdminPage() {
  const [stats, setStats] = useState({ revenue: 0, orders: 0, products: 0, users: 0 });
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: 'Studio Monitor X',
    slug: 'studio-monitor-x',
    description: 'Clean admin create flow for adding products.',
    price: '699',
    imageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=1200&q=80',
    stock: '9',
    categoryId: '1',
    featured: true,
  });
  const [message, setMessage] = useState('');

  const load = async () => {
    const [statsRes, productsRes, ordersRes, categoriesRes] = await Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/products'),
      api.get('/admin/orders'),
      api.get('/categories'),
    ]);
    setStats(statsRes.data.stats);
    setProducts(productsRes.data.products);
    setOrders(ordersRes.data.orders);
    setCategories(categoriesRes.data.categories);
    if (categoriesRes.data.categories[0]) {
      setForm((prev) => ({ ...prev, categoryId: String(categoriesRes.data.categories[0].id) }));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/admin/products', {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      categoryId: Number(form.categoryId),
    });
    setMessage('Product created.');
    load();
  };

  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <h2>Admin dashboard</h2>
          <p className="muted">Products, order overview and quick create form.</p>
        </div>
      </div>

      <div className="stats-grid admin-stats">
        <div className="stat-card"><strong>{stats.orders}</strong><span>orders</span></div>
        <div className="stat-card"><strong>{stats.revenue.toFixed(2)} zł</strong><span>revenue</span></div>
        <div className="stat-card"><strong>{stats.products}</strong><span>products</span></div>
        <div className="stat-card"><strong>{stats.users}</strong><span>users</span></div>
      </div>

      <div className="admin-layout top-gap">
        <form className="card stack-list" onSubmit={createProduct}>
          <h3>Add product</h3>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
          <input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Slug" />
          <textarea className="input textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
          <input className="input" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Image URL" />
          <div className="inline-form">
            <input className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" />
            <input className="input" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Stock" />
          </div>
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
            Featured product
          </label>
          {message ? <p className="success-text">{message}</p> : null}
          <button className="button full">Create product</button>
        </form>

        <div className="stack-list">
          <div className="card">
            <h3>Products</h3>
            <div className="table-wrap compact-top">
              <table className="simple-table">
                <thead>
                  <tr><th>Name</th><th>Price</th><th>Stock</th></tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.price.toFixed(2)} zł</td>
                      <td>{product.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Latest orders</h3>
            <div className="table-wrap compact-top">
              <table className="simple-table">
                <thead>
                  <tr><th>ID</th><th>Status</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {orders.slice(0, 6).map((order) => (
                    <tr key={order.id}>
                      <td>#{order.id}</td>
                      <td>{order.status}</td>
                      <td>{order.total.toFixed(2)} zł</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
