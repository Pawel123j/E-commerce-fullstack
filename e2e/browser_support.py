import contextlib
import http.server
import os
import subprocess
import threading
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent / 'artifacts'
(ROOT / 'logs').mkdir(parents=True, exist_ok=True)

@contextlib.contextmanager
def static_site(directory):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)
        def log_message(self, *args):
            pass
        def do_GET(self):
            if not Path(self.translate_path(self.path)).exists() and '.' not in self.path.rsplit('/', 1)[-1]:
                self.path = '/index.html'
            super().do_GET()
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}'
    finally:
        server.shutdown()
        server.server_close()
        thread.join()

@contextlib.contextmanager
def application(name, command, cwd, url, env=None):
    with (ROOT / 'logs' / f'{name}-http.log').open('w') as log:
        process = subprocess.Popen(command, cwd=cwd, env={**os.environ, **(env or {})}, stdout=log, stderr=log)
        try:
            for _ in range(120):
                if process.poll() is not None:
                    raise RuntimeError(f'{name} exited: {process.returncode}')
                try:
                    urllib.request.urlopen(url, timeout=1).close()
                    break
                except OSError:
                    time.sleep(.25)
            else:
                raise RuntimeError(f'{name} did not become ready')
            yield url
        finally:
            if process.poll() is None:
                process.terminate()
                try: process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)

@contextlib.contextmanager
def browser():
    with sync_playwright() as p:
        instance = p.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'), headless=True, args=['--no-sandbox'])
        try:
            yield instance
        finally:
            instance.close()
