// Real React providers and Axios interceptor, with controlled browser storage and
// a synthetic HTTP adapter. This is a component regression suite, not browser E2E.
const assert = require('node:assert/strict');
const { beforeEach, afterEach, test } = require('node:test');
const { createRequire } = require('node:module');
const path = require('node:path');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { MemoryRouter } = require('react-router-dom');
const { JSDOM } = require('jsdom');
const viteRequire = createRequire(require.resolve('vite/package.json'));
const { buildSync } = viteRequire('esbuild');
const clientRoot = path.resolve(__dirname, '..');
const result = buildSync({
  stdin: {
    contents: `export { CartProvider, useCart } from './src/state/CartContext';
      export { AuthProvider, useAuth } from './src/state/AuthContext';
      export { api, setApiToken } from './src/lib/api';
      export { default as App } from './src/App';`,
    resolveDir: clientRoot,
    loader: 'tsx',
  },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://shopflow.test/api') },
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(
  createRequire(path.join(clientRoot, 'package.json')), compiled, compiled.exports,
);
const { CartProvider, useCart, AuthProvider, useAuth, api, setApiToken, App } = compiled.exports;

const product = {
  id: 1, name: 'Example', slug: 'example', description: 'Product for tests', price: 12.5,
  imageUrl: '/example.png', featured: false, stock: 10, categoryId: 1,
  category: { id: 1, name: 'Examples', slug: 'examples' },
};
const item = { product, quantity: 2 };
const oldToken = 'oldHeader.oldPayload.oldSignature';
const newToken = 'newHeader.newPayload.newSignature';
const user = { id: 1, name: 'Test User', email: 'user@example.test', role: 'USER' };
let dom, storage, roots, cart, auth, requests;

function createStorage(values = {}) {
  return {
    values: new Map(Object.entries(values)), reads: [], writes: [], removes: [],
    readError: false, writeError: false, removeError: false,
    getItem(key) {
      this.reads.push(key);
      if (this.readError) throw new DOMException('Access denied', 'SecurityError');
      return this.values.get(key) ?? null;
    },
    setItem(key, value) {
      this.writes.push([key, value]);
      if (this.writeError) throw new DOMException('No storage space', 'QuotaExceededError');
      this.values.set(key, String(value));
    },
    removeItem(key) {
      this.removes.push(key);
      if (this.removeError) throw new DOMException('Access denied', 'SecurityError');
      this.values.delete(key);
    },
  };
}

function response(config, data) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://shopflow.test/' });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node']) {
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  }
  storage = createStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(dom.window, 'localStorage', { value: storage, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  roots = [];
  requests = [];
  setApiToken(null);
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return response(config, config.url === '/auth/me' ? { user } : { token: newToken, user });
  };
});

afterEach(async () => {
  await React.act(async () => { for (const root of roots) root.unmount(); });
  dom.window.close();
  setApiToken(null);
});

async function mount({ showApp = false, withAuth = true } = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const root = createRoot(element);
  roots.push(root);
  function Probe() {
    cart = useCart();
    if (withAuth) auth = useAuth();
    return showApp ? React.createElement(App) : null;
  }
  let tree = React.createElement(CartProvider, null, React.createElement(Probe));
  if (withAuth) tree = React.createElement(AuthProvider, null, tree);
  tree = React.createElement(MemoryRouter, { initialEntries: ['/cart'] }, tree);
  await React.act(async () => {
    root.render(React.createElement(React.StrictMode, null, tree));
  });
  return root;
}

for (const [label, raw] of [
  ['null', 'null'], ['object', '{}'], ['text', '"text"'], ['broken JSON', '{invalid'], ['empty JSON', ''],
  ['missing product', '[{"quantity":1}]'],
  ['string price', JSON.stringify([{ ...item, product: { ...product, price: '12.5' } }])],
  ['negative price', JSON.stringify([{ ...item, product: { ...product, price: -1 } }])],
  ['nonfinite price', JSON.stringify([{ ...item, product: { ...product, price: Infinity } }])],
  ['missing category', JSON.stringify([{ ...item, product: { ...product, category: null } }])],
  ['zero quantity', JSON.stringify([{ ...item, quantity: 0 }])],
  ['fractional quantity', JSON.stringify([{ ...item, quantity: 1.5 }])],
  ['excess quantity', JSON.stringify([{ ...item, quantity: 11 }])],
  ['duplicate product', JSON.stringify([item, item])],
  ['unsafe total', JSON.stringify([{ product: { ...product, price: 1e13, stock: 1000 }, quantity: 1000 }])],
]) {
  test(`cart preserves ${label} instead of crashing or replacing saved data`, async () => {
    storage.values.set('shopflow_cart', raw);
    await mount({ withAuth: false });
    assert.deepEqual(cart.items, []);
    assert.equal(cart.count, 0);
    assert.equal(cart.subtotal, 0);
    assert.match(cart.persistenceWarning, /original saved data has been left unchanged/);
    await React.act(() => cart.addItem(product));
    assert.equal(cart.count, 1);
    assert.equal(storage.values.get('shopflow_cart'), raw);
    assert.deepEqual(storage.writes, []);
  });
}

test('valid saved cart survives StrictMode mount, edits, reload and checkout clear', async () => {
  const raw = JSON.stringify([item]);
  storage.values.set('shopflow_cart', raw);
  const root = await mount({ withAuth: false });
  assert.equal(cart.count, 2);
  assert.equal(cart.subtotal, 25);
  assert.equal(cart.persistenceWarning, null);
  assert.deepEqual(storage.writes, [], 'mount must not write an empty initial cart');
  await React.act(() => cart.addItem(product, 3));
  assert.equal(cart.count, 5);
  assert.equal(JSON.parse(storage.values.get('shopflow_cart'))[0].quantity, 5);
  await React.act(() => root.unmount());
  roots.splice(roots.indexOf(root), 1);
  await mount({ withAuth: false });
  assert.equal(cart.count, 5);
  await React.act(() => cart.clear());
  assert.equal(cart.count, 0);
  assert.equal(storage.values.get('shopflow_cart'), '[]');
});

test('denied storage read keeps cart usable in memory without trying to overwrite unknown data', async () => {
  storage.values.set('shopflow_cart', JSON.stringify([item]));
  storage.readError = true;
  await mount({ withAuth: false });
  assert.match(cart.persistenceWarning, /storage is unavailable/);
  await React.act(() => cart.addItem(product, 2));
  assert.equal(cart.count, 2);
  assert.deepEqual(storage.writes, []);
});

test('quota failure retains previous saved cart and warns on the actual app', async () => {
  const raw = JSON.stringify([item]);
  storage.values.set('shopflow_cart', raw);
  await mount({ showApp: true });
  storage.writeError = true;
  await React.act(() => cart.addItem(product));
  assert.equal(cart.count, 3);
  assert.equal(storage.values.get('shopflow_cart'), raw);
  assert.match(document.querySelector('[role="status"]').textContent, /could not be saved/);
  await React.act(() => cart.clear());
  assert.deepEqual(cart.items, []);
  assert.equal(storage.writes.length, 1, 'do not repeatedly attempt automatic writes after failure');
  assert.equal(storage.values.get('shopflow_cart'), raw);
});

test('cart rejects invalid mutations and clamps safe integer quantities to stock', async () => {
  await mount({ withAuth: false });
  for (const quantity of [NaN, Infinity, -1, 0, 1.5]) {
    await React.act(() => cart.addItem(product, quantity));
  }
  await React.act(() => cart.addItem({ ...product, price: NaN }));
  await React.act(() => cart.addItem({ ...product, stock: 0 }));
  assert.equal(cart.count, 0);
  await React.act(() => cart.addItem(product, 99));
  assert.equal(cart.count, 10);
  for (const quantity of [NaN, Infinity, -1, 0, 1.5]) {
    await React.act(() => cart.updateQuantity(product.id, quantity));
  }
  assert.equal(cart.count, 10);
  await React.act(() => cart.updateQuantity(product.id, 3));
  assert.equal(cart.subtotal, 37.5);
  await React.act(() => cart.removeItem(product.id));
  assert.equal(cart.count, 0);
});

test('invalid saved token never authenticates or becomes an Authorization header', async () => {
  storage.values.set('shopflow_token', 'not-a-token');
  await mount();
  assert.equal(auth.user, null);
  assert.equal(auth.token, null);
  assert.equal(requests.length, 0);
  await api.get('/products');
  assert.equal(requests.at(-1).headers.Authorization, undefined);
});

test('denied storage does not block in-memory sign-in or subsequent authenticated API calls', async () => {
  storage.readError = true;
  storage.writeError = true;
  storage.removeError = true;
  await mount({ showApp: true });
  await React.act(() => auth.login('user@example.test', 'test-password'));
  assert.deepEqual(auth.user, user);
  assert.equal(auth.token, newToken);
  assert.match(document.querySelector('[role="status"]').textContent, /Signed in for this tab only/);
  await api.get('/orders/my');
  assert.equal(requests.at(-1).headers.Authorization, `Bearer ${newToken}`);
});

test('failed persistent logout never reuses the old saved token and warns about reload', async () => {
  storage.values.set('shopflow_token', oldToken);
  await mount({ showApp: true });
  assert.deepEqual(auth.user, user);
  storage.removeError = true;
  await React.act(() => auth.logout());
  assert.equal(auth.user, null);
  assert.equal(auth.token, null);
  assert.equal(storage.values.get('shopflow_token'), oldToken);
  assert.match(document.querySelector('[role="status"]').textContent, /may return after reload/);
  await api.get('/orders/my');
  assert.equal(requests.at(-1).headers.Authorization, undefined);
});

test('failed saving a new sign-in clears a previous saved token when removal is allowed', async () => {
  storage.values.set('shopflow_token', oldToken);
  await mount();
  storage.writeError = true;
  await React.act(() => auth.login('user@example.test', 'test-password'));
  assert.equal(auth.token, newToken);
  assert.equal(storage.values.has('shopflow_token'), false);
  assert.match(auth.persistenceWarning, /will be lost on reload/);
});

test('invalid API identity never creates a session or persists a token', async () => {
  api.defaults.adapter = async (config) => response(config, { token: newToken, user: { role: 'ADMIN' } });
  await mount();
  await React.act(async () => {
    await assert.rejects(auth.login('user@example.test', 'test-password'), /invalid sign-in response/);
  });
  assert.equal(auth.token, null);
  assert.equal(auth.user, null);
  assert.equal(storage.values.has('shopflow_token'), false);
});

test('invalid restored API identity is rejected even when token removal fails', async () => {
  storage.values.set('shopflow_token', oldToken);
  storage.removeError = true;
  api.defaults.adapter = async (config) => response(config, { user: { id: 1, role: 'ADMIN' } });
  await mount();
  assert.equal(auth.token, null);
  assert.equal(auth.user, null);
  assert.match(auth.persistenceWarning, /saved sign-in could not be removed/);
  let header;
  api.defaults.adapter = async (config) => { header = config.headers.Authorization; return response(config, {}); };
  await api.get('/orders/my');
  assert.equal(header, undefined);
});

test('late restored identity cannot sign a user back in after logout', async () => {
  storage.values.set('shopflow_token', oldToken);
  const pending = [];
  api.defaults.adapter = (config) => new Promise((resolve) => pending.push(() => resolve(response(config, { user }))));
  await mount();
  assert.ok(pending.length > 0);
  await React.act(() => auth.logout());
  await React.act(async () => { pending.forEach((resolve) => resolve()); });
  assert.equal(auth.user, null);
  assert.equal(auth.token, null);
  assert.equal(auth.loading, false);
});

test('logout during pending login prevents that response from recreating a session', async () => {
  await mount();
  let release;
  api.defaults.adapter = (config) => new Promise((resolve) => { release = () => resolve(response(config, { token: newToken, user })); });
  let outcome;
  await React.act(async () => {
    outcome = auth.login('user@example.test', 'test-password').then(() => null, (error) => error);
    await new Promise((resolve) => setImmediate(resolve));
  });
  await React.act(() => auth.logout());
  await React.act(async () => { release(); });
  assert.match((await outcome).message, /cancelled/);
  assert.equal(auth.user, null);
  assert.equal(auth.token, null);
  assert.equal(storage.values.has('shopflow_token'), false);
});

test('failed login during restoration ends loading and cannot revive the previous identity', async () => {
  storage.values.set('shopflow_token', oldToken);
  const pending = [];
  api.defaults.adapter = (config) => {
    if (config.url === '/auth/login') return Promise.reject(new Error('Invalid credentials'));
    return new Promise((resolve) => pending.push(() => resolve(response(config, { user }))));
  };
  await mount();
  await React.act(async () => {
    await assert.rejects(auth.login('user@example.test', 'bad-password'), /Invalid credentials/);
  });
  await React.act(async () => { pending.forEach((resolve) => resolve()); });
  assert.equal(auth.loading, false);
  assert.equal(auth.user, null);
  assert.equal(auth.token, null);
  assert.equal(storage.values.has('shopflow_token'), false);
});

test('sign-out in another tab ends the memory session without adopting another identity', async () => {
  storage.values.set('shopflow_token', oldToken);
  await mount();
  assert.deepEqual(auth.user, user);
  await React.act(() => window.dispatchEvent(new dom.window.StorageEvent('storage', {
    key: 'shopflow_cart', newValue: '[]',
  })));
  assert.deepEqual(auth.user, user, 'cart updates do not affect authentication');
  storage.values.delete('shopflow_token');
  await React.act(() => window.dispatchEvent(new dom.window.StorageEvent('storage', {
    key: 'shopflow_token', newValue: null,
  })));
  assert.equal(auth.user, null);
  assert.equal(auth.token, null);
  assert.match(auth.persistenceWarning, /another tab/);
  await api.get('/orders/my');
  assert.equal(requests.at(-1).headers.Authorization, undefined);
});
