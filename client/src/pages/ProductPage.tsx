import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCart } from '../state/CartContext';
import type { Product } from '../types';

export function ProductPage() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!slug) return;
    api.get(`/products/${slug}`).then((res) => setProduct(res.data.product));
  }, [slug]);

  if (!product) {
    return <div className="container section">Loading product...</div>;
  }

  return (
    <section className="section container">
      <div className="product-detail">
        <div className="card image-card">
          <img src={product.imageUrl} alt={product.name} className="product-detail-image" />
        </div>
        <div className="card product-detail-info">
          <span className="pill">{product.category.name}</span>
          <h2>{product.name}</h2>
          <p className="muted">{product.description}</p>
          <div className="price-row">
            <span className="price big">{product.price.toFixed(2)} zł</span>
            <span className="stock-tag">{product.stock} in stock</span>
          </div>
          <div className="quantity-row">
            <label>Quantity</label>
            <input
              className="input quantity-input"
              type="number"
              min={1}
              max={product.stock}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
          <button className="button large" onClick={() => addItem(product, quantity)}>
            Add to cart
          </button>
        </div>
      </div>
    </section>
  );
}
