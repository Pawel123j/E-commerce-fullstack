import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductPage } from './pages/ProductPage';
import { CartPage } from './pages/CartPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { useAuth } from './state/AuthContext';

function Header() {
  const { user, logout, sessionError, retrySession } = useAuth();
  return (
    <header className="site-header">
      <div className="container nav-row">
        <Link to="/" className="brand">ShopFlow</Link>
        <nav className="nav-links">
          <Link to="/products">Products</Link>
          <Link to="/cart">Cart</Link>
          {user ? <Link to="/account">Account</Link> : null}
          {user?.role === 'ADMIN' ? <Link to="/admin">Admin</Link> : null}
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="welcome-chip">Hi, {user.name.split(' ')[0]}</span>
              <button className="button secondary" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="button secondary">Login</Link>
              <Link to="/register" className="button">Register</Link>
            </>
          )}
        </div>
      </div>
      <div className="container demo-notice">Demo store · prices in PLN · simulated orders, no payment or delivery.</div>
      {sessionError && <div className="container" role="alert">{sessionError} <button className="button secondary" onClick={retrySession}>Retry session</button></div>}
    </header>
  );
}

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { user, loading, sessionError } = useAuth();
  if (loading) return <div className="container section">Loading...</div>;
  if (sessionError) return <div className="container section">Use Retry session above to continue.</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }: { children: React.ReactElement }) {
  const { user, loading, sessionError } = useAuth();
  if (loading) return <div className="container section">Loading...</div>;
  if (sessionError) return <div className="container section">Use Retry session above to continue.</div>;
  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:slug" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/account"
          element={<ProtectedRoute><AccountPage /></ProtectedRoute>}
        />
        <Route
          path="/admin"
          element={<AdminRoute><AdminPage /></AdminRoute>}
        />
      </Routes>
    </div>
  );
}
