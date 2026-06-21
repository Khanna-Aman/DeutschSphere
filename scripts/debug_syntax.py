import os
import sys
import http.server
import socketserver
import threading
from playwright.sync_api import sync_playwright

PORT = 54999

class SilentHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def run_server():
    Handler = SilentHTTPHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

# Start local server in background
t = threading.Thread(target=run_server, daemon=True)
t.start()

print(f"Started debug server on port {PORT}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    def on_page_error(err):
        print("\n=== UNCAUGHT PAGE ERROR ===")
        print(f"Message: {err.message}")
        print(f"Stack: {err.stack}")
        print("============================\n")
        
    def on_console(msg):
        print(f"[CONSOLE {msg.type.upper()}] {msg.text}")
        if msg.location:
            print(f"  Location: {msg.location}")

    def on_request(req):
        pass

    def on_response(res):
        print(f"[HTTP] {res.status} {res.url} ({len(res.body()) if res.ok else 0} bytes)")

    page.on("pageerror", on_page_error)
    page.on("console", on_console)
    page.on("request", on_request)
    page.on("response", on_response)
    
    try:
        page.goto(f"http://localhost:{PORT}/index.html")
        page.wait_for_timeout(3000)
    except Exception as e:
        print(f"Exception: {e}")
        
    browser.close()
print("Done checking.")
