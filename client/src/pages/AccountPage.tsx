import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import type { Order } from '../types';

export function AccountPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.get('/orders/my').then((res) => setOrders(res.data.orders));
  }, []);

  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <h2>My account</h2>
          <p className="muted">Signed in as {user?.email}</p>
        </div>
      </div>

      <div className="info-grid">
        <div className="card">
          <h3>Profile</h3>
          <p className="muted compact-top">{user?.name}</p>
          <p className="muted">Role: {user?.role}</p>
        </div>
        <div className="card">
          <h3>Orders</h3>
          <p className="muted compact-top">You have {orders.length} order(s).</p>
        </div>
      </div>

      <div className="stack-list top-gap">
        {orders.map((order) => (
          <div className="card" key={order.id}>
            <div className="order-head">
              <div>
                <h3>Order #{order.id}</h3>
                <p className="muted">{new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <span className="pill">{order.status}</span>
            </div>
            <div className="order-items compact-top">
              {order.items.map((item) => (
                <div className="summary-row" key={item.id}>
                  <span>{item.productName} × {item.quantity}</span>
                  <strong>{item.total.toFixed(2)} zł</strong>
                </div>
              ))}
            </div>
            <div className="summary-row total top-gap-small">
              <span>Total</span>
              <strong>{order.total.toFixed(2)} zł</strong>
            </div>
          </div>
        ))}
        {orders.length === 0 ? <div className="card">No orders yet.</div> : null}
      </div>
    </section>
  );
}
