import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ProductCard } from '../components/ProductCard';
import type { Product } from '../types';

export function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);

  useEffect(() => {
    api.get('/products?featured=true').then((res) => setFeatured(res.data.products));
  }, []);

  return (
    <div>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="pill">Full stack e-commerce</span>
            <h1>Modern shop that looks clean and still stays easy to run locally.</h1>
            <p>
              Auth, products, cart, checkout, coupons, orders and admin panel in one proper base.
            </p>
            <div className="hero-actions">
              <Link to="/products" className="button">Browse products</Link>
              <Link to="/admin" className="button secondary">Admin preview</Link>
            </div>
            <div className="stats-grid">
              <div className="stat-card"><strong>12+</strong><span>products seeded</span></div>
              <div className="stat-card"><strong>JWT</strong><span>auth included</span></div>
              <div className="stat-card"><strong>SQLite</strong><span>easy local start</span></div>
            </div>
          </div>
          <div className="hero-panel">
            <img
              src="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80"
              alt="Hero"
            />
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <div>
            <h2>Featured products</h2>
            <p className="muted">Starter already seeded with solid looking demo products.</p>
          </div>
          <Link to="/products" className="button secondary">See all</Link>
        </div>
        <div className="product-grid">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
