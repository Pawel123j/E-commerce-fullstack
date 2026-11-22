import json
import os
import subprocess
import tempfile
import pytest
from pathlib import Path
from playwright.sync_api import expect
from accessibility import assert_accessible
from browser_support import application, browser, static_site, ROOT



REPO = Path(__file__).resolve().parents[1]
SERVER = REPO / 'server'

@pytest.fixture
def shopflow_site():
    with tempfile.TemporaryDirectory(prefix='shopflow-e2e-') as temp:
        Path(temp, 'shop.db').touch()
        env = {**os.environ, 'DATABASE_URL': f'file:{temp}/shop.db', 'RUST_LOG': 'info',
               'JWT_SECRET': 'isolated-browser-test-secret-not-production', 'PORT': '18311'}
        with (ROOT/'logs'/'shopflow-e2e-setup.log').open('w') as log:
            for cmd in (['node','node_modules/prisma/build/index.js','migrate','deploy'],
                        ['node','node_modules/prisma/build/index.js','migrate','deploy'],
                        ['node','--import','tsx','prisma/seed.ts']):
                subprocess.run(cmd, cwd=SERVER, env=env, check=True, stdout=log, stderr=log)
            subprocess.run(['node','--input-type=module','-e',
                "import {createPrismaClient} from './dist/prismaClient.js'; const p=createPrismaClient(); await p.coupon.create({data:{code:'SAVE25',type:'FIXED',value:2500,minTotal:10000}}); await p.$disconnect();"],
                cwd=SERVER, env=env, check=True, stdout=log, stderr=log)
        with static_site(REPO / 'client/dist') as url:
            env['CLIENT_URL'] = url
            with application('shopflow', ['node','dist/index.js'], SERVER, 'http://127.0.0.1:18311/api/health', env):
                yield url


def test_checkout_uses_real_coupon_and_persists_order(shopflow_site):
    url = shopflow_site
    with browser() as b:
        page = b.new_page(viewport={'width':1280,'height':900})
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto(url+'/products')
        expect(page.get_by_role('heading', name='Catalog', exact=True)).to_be_visible()
        expect(page.locator('.product-image').first).to_have_js_property('naturalWidth', 800)
        page.screenshot(path=str(REPO/'docs'/'screenshots'/'browser-catalog.png'), full_page=True)
        page.goto(url+'/register')
        assert_accessible(page, REPO, 'register')
        page.get_by_placeholder('Full name', exact=True).fill('Browser Customer')
        page.get_by_placeholder('Email', exact=True).fill('browser@shopflow.test')
        page.get_by_placeholder('Password', exact=True).fill('Test-browser-2026!')
        page.get_by_role('button',name='Register',exact=True).click()
        expect(page).to_have_url(url+'/account')
        page.goto(url+'/products/auralux-pro-headphones')
        page.get_by_role('button',name='Add to cart',exact=True).click()
        page.get_by_role('link',name='Cart',exact=True).click()
        page.get_by_label('Coupon code').fill('SAVE25')
        page.get_by_role('button',name='Check',exact=True).click()
        expect(page.get_by_text('SAVE25: 25 zł off',exact=True)).to_be_visible()
        expect(page.locator('.summary-row').filter(has_text='Discount')).to_have_text('Discount-25.00 zł')
        expect(page.locator('.summary-row.total')).to_have_text('Total474.00 zł')
        assert_accessible(page, REPO, 'checkout')
        page.get_by_placeholder('Address',exact=True).fill('Test Street 12, Warsaw')
        page.get_by_role('button',name='Place demo order',exact=True).click()
        expect(page).to_have_url(url+'/account')
        expect(page.get_by_text('474.00 zł',exact=True)).to_be_visible()
        page.reload()
        expect(page.get_by_text('474.00 zł',exact=True)).to_be_visible()
        assert_accessible(page, REPO, 'account')
        page.screenshot(path=str(ROOT/'logs'/'shopflow-checkout.png'))
        page.screenshot(path=str(REPO/'docs'/'screenshots'/'browser-checkout.png'), full_page=True)
        assert not errors, errors


def test_corrupt_cart_stays_untouched_and_legacy_cart_is_migrated_after_edit(shopflow_site):
    url = shopflow_site
    with browser() as b:
        page = b.new_page()
        page.goto(url + '/products/auralux-pro-headphones')
        page.get_by_role('button', name='Add to cart', exact=True).click()
        original_cart = page.evaluate("JSON.parse(localStorage.getItem('shopflow_cart'))")
        assert original_cart['version'] == 1 and len(original_cart['items']) == 1
        # Invalid saved data must not be replaced on mount or on further edits.
        raw = ' {"broken":'
        page.evaluate("value => localStorage.setItem('shopflow_cart', value)", raw)
        page.reload()
        expect(page.get_by_role('status')).to_contain_text('original saved data has been left unchanged')
        page.get_by_role('button', name='Add to cart', exact=True).click()
        page.get_by_role('link', name='Cart', exact=True).click()
        expect(page.get_by_role('heading', name='Auralux Pro Headphones', exact=True)).to_be_visible()
        assert page.evaluate("localStorage.getItem('shopflow_cart')") == raw

        # A real result in the historical array format survives mount unchanged.
        page.evaluate("items => localStorage.setItem('shopflow_cart', JSON.stringify(items))", original_cart['items'])
        page.reload()
        expect(page.get_by_role('status')).to_have_count(0)
        quantity = page.get_by_label('Quantity for Auralux Pro Headphones')
        expect(quantity).to_have_value('1')
        assert isinstance(page.evaluate("JSON.parse(localStorage.getItem('shopflow_cart'))"), list)
        quantity.fill('2')
        quantity.blur()
        page.wait_for_function("JSON.parse(localStorage.getItem('shopflow_cart')).items?.[0].quantity === 2")
        page.reload()
        expect(page.get_by_label('Quantity for Auralux Pro Headphones')).to_have_value('2')


def test_session_network_retry_then_failed_persistent_logout_cannot_reuse_token(shopflow_site):
    url = shopflow_site
    with browser() as b:
        page = b.new_page()
        page.goto(url + '/register')
        page.get_by_placeholder('Full name', exact=True).fill('Session Customer')
        page.get_by_placeholder('Email', exact=True).fill('session@shopflow.test')
        page.get_by_placeholder('Password', exact=True).fill('Test-session-2026!')
        page.get_by_role('button', name='Register', exact=True).click()
        expect(page).to_have_url(url + '/account')
        token = page.evaluate("localStorage.getItem('shopflow_token')")
        assert token
        # Fault injection affects only network transport; retry uses the real API.
        page.route('**/api/auth/me', lambda route: route.abort())
        page.reload()
        expect(page.get_by_role('alert')).to_contain_text('Session could not be checked')
        assert page.evaluate("localStorage.getItem('shopflow_token')") == token
        page.unroute('**/api/auth/me')
        page.get_by_role('button', name='Retry session', exact=True).click()
        expect(page.get_by_role('heading', name='My account', exact=True)).to_be_visible()
        expect(page.get_by_role('alert')).to_have_count(0)
        page.evaluate("""() => {
            const original = Storage.prototype.removeItem;
            Storage.prototype.removeItem = function(key) {
                if (key === 'shopflow_token') throw new DOMException('Blocked', 'SecurityError');
                return original.call(this, key);
            };
        }""")
        page.get_by_role('button', name='Logout', exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('may return after reload')
        assert page.evaluate("localStorage.getItem('shopflow_token')") == token
        with page.expect_request('**/api/products*') as request:
            page.get_by_role('link', name='Products', exact=True).click()
        assert 'authorization' not in request.value.all_headers()
