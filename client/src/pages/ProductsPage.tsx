import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { ProductCard } from '../components/ProductCard';
import type { Category, Product } from '../types';

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories));
    api.get('/products').then((res) => setProducts(res.data.products));
  }, []);

  const filtered = useMemo(() => {
    const byCategory = category === 'all' ? products : products.filter((p) => p.category.slug === category);
    const bySearch = byCategory.filter((p) =>
      `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()),
    );

    return [...bySearch].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'name') return a.name.localeCompare(b.name);
      return b.id - a.id;
    });
  }, [products, search, category, sort]);

  return (
    <section className="section container">
      <div className="section-head stack-mobile">
        <div>
          <h2>Catalog</h2>
          <p className="muted">Filter, search and sort products like a normal store, not a dead demo.</p>
        </div>
        <div className="filters">
          <input
            className="input"
            placeholder="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>{cat.name}</option>
            ))}
          </select>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="price-asc">Price low to high</option>
            <option value="price-desc">Price high to low</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <div className="product-grid">
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
