import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import { useCart } from '../state/CartContext';

export function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('WELCOME10');
  const [couponInfo, setCouponInfo] = useState<string>('');
  const [shippingName, setShippingName] = useState(user?.name || '');
  const [shippingEmail, setShippingEmail] = useState(user?.email || '');
  const [shippingAddress, setShippingAddress] = useState('Kraków, ul. Demo 10/5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const discount = useMemo(() => {
    if (couponCode.trim().toUpperCase() === 'WELCOME10' && subtotal >= 300) {
      return subtotal * 0.1;
    }
    return 0;
  }, [couponCode, subtotal]);

  const total = subtotal - discount;

  const validateCoupon = async () => {
    try {
      const { data } = await api.get(`/coupons/${couponCode.trim()}`);
      setCouponInfo(`${data.coupon.code}: ${data.coupon.type === 'PERCENT' ? `${data.coupon.value}% off` : `${data.coupon.value} zł off`}`);
      setError('');
    } catch (err: any) {
      setCouponInfo('');
      setError(err?.response?.data?.message || 'Coupon not found');
    }
  };

  const submitOrder = async () => {
    if (!user) {
      setError('Login first to place an order.');
      return;
    }
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/orders', {
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        couponCode: couponCode.trim() || undefined,
        shippingName,
        shippingEmail,
        shippingAddress,
      });
      clear();
      navigate('/account');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <h2>Cart & checkout</h2>
          <p className="muted">Local cart, coupon check and real order creation through the API.</p>
        </div>
      </div>

      <div className="checkout-layout">
        <div className="stack-list">
          {items.length === 0 ? <div className="card">Cart is empty.</div> : null}
          {items.map((item) => (
            <div className="card cart-item" key={item.product.id}>
              <img src={item.product.imageUrl} alt={item.product.name} className="cart-thumb" />
              <div className="cart-main">
                <h3>{item.product.name}</h3>
                <p className="muted">{item.product.price.toFixed(2)} zł each</p>
                <div className="cart-actions-row">
                  <input
                    className="input quantity-input"
                    type="number"
                    min={1}
                    max={item.product.stock}
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                  />
                  <button className="button secondary" onClick={() => removeItem(item.product.id)}>Remove</button>
                </div>
              </div>
              <div className="price">{(item.product.price * item.quantity).toFixed(2)} zł</div>
            </div>
          ))}
        </div>

        <div className="stack-list">
          <div className="card">
            <h3>Coupon</h3>
            <div className="inline-form compact-top">
              <input className="input" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
              <button className="button secondary" onClick={validateCoupon}>Check</button>
            </div>
            {couponInfo ? <p className="success-text">{couponInfo}</p> : null}
          </div>

          <div className="card">
            <h3>Shipping</h3>
            <div className="form-grid compact-top">
              <input className="input" placeholder="Full name" value={shippingName} onChange={(e) => setShippingName(e.target.value)} />
              <input className="input" placeholder="Email" value={shippingEmail} onChange={(e) => setShippingEmail(e.target.value)} />
              <textarea className="input textarea" placeholder="Address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <h3>Summary</h3>
            <div className="summary-row"><span>Subtotal</span><strong>{subtotal.toFixed(2)} zł</strong></div>
            <div className="summary-row"><span>Discount</span><strong>-{discount.toFixed(2)} zł</strong></div>
            <div className="summary-row total"><span>Total</span><strong>{total.toFixed(2)} zł</strong></div>
            {error ? <p className="error-text">{error}</p> : null}
            <button className="button large full" disabled={loading} onClick={submitOrder}>
              {loading ? 'Placing order...' : user ? 'Place order' : 'Login to checkout'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
