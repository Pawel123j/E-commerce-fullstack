import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import { useCart } from '../state/CartContext';

type Coupon = { code: string; type: 'PERCENT' | 'FIXED'; value: number; minTotal: number; active: boolean };

export function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, clear, storageError } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('WELCOME10');
  const [couponInfo, setCouponInfo] = useState<string>('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [shippingName, setShippingName] = useState(user?.name || '');
  const [shippingEmail, setShippingEmail] = useState(user?.email || '');
  const [shippingAddress, setShippingAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const discount = useMemo(() => {
    if (!coupon?.active || coupon.code !== couponCode.trim().toUpperCase() || subtotal < coupon.minTotal) return 0;
    return Math.min(subtotal, coupon.type === 'PERCENT' ? Math.floor((Math.round(subtotal * 100) * Math.round(coupon.value * 100) + 5000) / 10000) / 100 : coupon.value);
  }, [coupon, couponCode, subtotal]);

  const total = (Math.round(subtotal * 100) - Math.round(discount * 100)) / 100;

  const validateCoupon = async () => {
    try {
      const { data } = await api.get(`/coupons/${couponCode.trim()}`);
      setCoupon(data.coupon);
      setCouponInfo(`${data.coupon.code}: ${data.coupon.type === 'PERCENT' ? `${data.coupon.value}% off` : `${data.coupon.value} zł off`}`);
      setError('');
    } catch (err: any) {
      setCoupon(null);
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
        couponCode: coupon?.code === couponCode.trim().toUpperCase() ? coupon.code : undefined,
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
          <p className="muted">Review your basket and create a simulated order. No money is charged and nothing is shipped.</p>
        </div>
      </div>

      {storageError && <p role="status">Browser storage is unavailable. Your basket works for this visit but may not survive a reload.</p>}
      <form className="checkout-layout" onSubmit={(event) => { event.preventDefault(); void submitOrder(); }}>
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
                    aria-label={`Quantity for ${item.product.name}`}
                    type="number"
                    min={1}
                    max={item.product.stock}
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                  />
                  <button className="button secondary" type="button" onClick={() => removeItem(item.product.id)}>Remove</button>
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
              <input aria-label="Coupon code" className="input" value={couponCode} onChange={(e) => {
                setCouponCode(e.target.value);
                setCoupon(null);
                setCouponInfo('');
              }} />
              <button className="button secondary" type="button" onClick={validateCoupon}>Check</button>
            </div>
            {couponInfo ? <p className="success-text">{couponInfo}</p> : null}
            {coupon && subtotal < coupon.minTotal ? <p className="muted">Minimum subtotal: {coupon.minTotal.toFixed(2)} zł</p> : null}
          </div>

          <div className="card">
            <h3>Shipping</h3>
            <div className="form-grid compact-top">
              <label htmlFor="shipping-name">Full name</label>
              <input id="shipping-name" name="name" autoComplete="name" required minLength={2} className="input" placeholder="Full name" value={shippingName} onChange={(e) => setShippingName(e.target.value)} />
              <label htmlFor="shipping-email">Email</label>
              <input id="shipping-email" name="email" type="email" autoComplete="email" required className="input" placeholder="Email" value={shippingEmail} onChange={(e) => setShippingEmail(e.target.value)} />
              <label htmlFor="shipping-address">Delivery address (demo)</label>
              <textarea id="shipping-address" name="address" autoComplete="street-address" required minLength={5} className="input textarea" placeholder="Address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <h3>Summary</h3>
            <div className="summary-row"><span>Subtotal</span><strong>{subtotal.toFixed(2)} zł</strong></div>
            <div className="summary-row"><span>Discount</span><strong>-{discount.toFixed(2)} zł</strong></div>
            <div className="summary-row total"><span>Total</span><strong>{total.toFixed(2)} zł</strong></div>
            {error ? <p className="error-text" role="alert">{error}</p> : null}
            <button className="button large full" type="submit" disabled={loading || items.length === 0}>
              {loading ? 'Placing order...' : user ? 'Place demo order' : 'Login to checkout'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
