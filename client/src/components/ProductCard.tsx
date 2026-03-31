import { Link } from 'react-router-dom';
import { useCart } from '../state/CartContext';
import type { Product } from '../types';

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <article className="card product-card">
      <Link to={`/products/${product.slug}`} className="product-image-wrap">
        <img src={product.imageUrl} alt={product.name} className="product-image" />
      </Link>
      <div className="product-content">
        <div className="product-meta">
          <span className="chip">{product.category.name}</span>
          <span className="stock-tag">Stock: {product.stock}</span>
        </div>
        <Link to={`/products/${product.slug}`} className="product-title-link">
          <h3>{product.name}</h3>
        </Link>
        <p className="muted">{product.description.slice(0, 90)}...</p>
        <div className="product-footer">
          <span className="price">{product.price.toFixed(2)} zł</span>
          <button className="button" onClick={() => addItem(product, 1)}>
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
}
