import json
import os
import subprocess
import tempfile
from pathlib import Path
from playwright.sync_api import expect
from accessibility import assert_accessible
from browser_support import application, browser, static_site, ROOT



REPO = Path(__file__).resolve().parents[1]
SERVER = REPO / 'server'

def test_checkout_uses_real_coupon_and_persists_order():
    with tempfile.TemporaryDirectory(prefix='shopflow-e2e-') as temp:
        env = {**os.environ, 'DATABASE_URL': f'file:{temp}/shop.db', 'RUST_LOG': 'info',
               'JWT_SECRET': 'isolated-browser-test-secret-not-production', 'PORT': '18311'}
        with (ROOT/'logs'/'shopflow-e2e-setup.log').open('w') as log:
            for cmd in (['node','node_modules/prisma/build/index.js','migrate','deploy'],
                        ['node','node_modules/prisma/build/index.js','migrate','deploy'],
                        ['node','--import','tsx','prisma/seed.ts']):
                subprocess.run(cmd, cwd=SERVER, env=env, check=True, stdout=log, stderr=log)
            subprocess.run(['node','--input-type=module','-e',
                "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); await p.coupon.create({data:{code:'SAVE25',type:'FIXED',value:25,minTotal:100}}); await p.$disconnect();"],
                cwd=SERVER, env=env, check=True, stdout=log, stderr=log)
        with static_site(REPO / 'client/dist') as url:
            env['CLIENT_URL'] = url
            with application('shopflow', ['node','dist/index.js'], SERVER, 'http://127.0.0.1:18311/api/health', env), browser() as b:
                page = b.new_page(viewport={'width':1280,'height':900})
                errors=[]
                page.on('pageerror',lambda e: errors.append(str(e)))
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
                page.get_by_role('button',name='Place order',exact=True).click()
                expect(page).to_have_url(url+'/account')
                expect(page.get_by_text('474.00 zł',exact=True)).to_be_visible()
                page.reload()
                expect(page.get_by_text('474.00 zł',exact=True)).to_be_visible()
                assert_accessible(page, REPO, 'account')
                page.screenshot(path=str(ROOT/'logs'/'shopflow-checkout.png'))
                assert not errors, errors
