import os
import sys
import time
import socket
import threading
from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from playwright.sync_api import sync_playwright

# 1. Choose a free port
def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('', 0))
    port = s.getsockname()[1]
    s.close()
    return port

PORT = get_free_port()
print(f"Using free port: {PORT}")

# 2. Start Python simple HTTP server in a thread
class ThreadedTCPServer(TCPServer):
    allow_reuse_address = True

# Change working directory to the project root directory
os.chdir(r"D:\Aman\_________Projects\A1-B1_German")

server = ThreadedTCPServer(("", PORT), SimpleHTTPRequestHandler)
server_thread = threading.Thread(target=server.serve_forever)
server_thread.daemon = True
server_thread.start()
print("Local HTTP server started.")

# 3. Create screenshot directory in artifacts
screenshot_dir = r"C:\Users\aman-\.gemini\antigravity\brain\f2987053-40c8-4c2e-a51a-8a76b46fedbc"
os.makedirs(screenshot_dir, exist_ok=True)

try:
    with sync_playwright() as p:
        # Launch Chromium
        browser = p.chromium.launch(headless=True)
        # Create context
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        
        # Navigate to index.html
        url = f"http://localhost:{PORT}/index.html"
        print(f"Navigating to {url}")
        page.goto(url)
        
        # Wait for loader overlay to be hidden
        print("Waiting for page load and loader overlay to hide...")
        page.wait_for_selector("#loader-overlay", state="hidden", timeout=10000)
        time.sleep(2)  # extra sleep for animations and cards loading
        
        # Screenshot 1: Flashcards View (Default Theme)
        p1 = os.path.join(screenshot_dir, "weaver_01_flashcards.png")
        page.screenshot(path=p1)
        print(f"Screenshot saved: {p1}")
        
        # Navigate to Grammatik-Weberei by hash route
        print("Navigating to Grammatik-Weberei via hash...")
        page.evaluate("window.location.hash = '#/weaver'")
        time.sleep(1)
        
        # Screenshot 2: Weaver Intro Panel
        p2 = os.path.join(screenshot_dir, "weaver_02_intro.png")
        page.screenshot(path=p2)
        print(f"Screenshot saved: {p2}")
        
        # Click "Training starten" button
        print("Clicking Weaver start button...")
        page.click("#weaver-start-btn")
        time.sleep(1.5)
        
        # Screenshot 3: Active Weaver Board
        p3 = os.path.join(screenshot_dir, "weaver_03_active_board.png")
        page.screenshot(path=p3)
        print(f"Screenshot saved: {p3}")
        
        # Click the first word chip in the pool (testing click-to-snap)
        print("Clicking first scrambled chip in the pool...")
        first_chip = page.locator("#weaver-chips-pool .weaver-chip").first
        if first_chip.is_visible():
            chip_text = first_chip.inner_text()
            print(f"First chip text: {chip_text}")
            first_chip.click()
            time.sleep(0.5)
            
            # Screenshot 4: Active Board with one clicked chip
            p4 = os.path.join(screenshot_dir, "weaver_04_chip_clicked.png")
            page.screenshot(path=p4)
            print(f"Screenshot saved: {p4}")
            
            # Reset
            print("Clicking reset button...")
            page.click("#weaver-reset-btn")
            time.sleep(0.5)
        else:
            print("No word chips visible in pool.")
            
        # Select theme Weimar Classic
        print("Switching theme to Weimar Classic...")
        page.evaluate("applyTheme('weimar')")
        time.sleep(1)
        
        # Screenshot 5: Weimar Classic Theme board
        p5 = os.path.join(screenshot_dir, "weaver_05_weimar_theme.png")
        page.screenshot(path=p5)
        print(f"Screenshot saved: {p5}")
        
        # Select theme Cyberpunk
        print("Switching theme to Cyberpunk...")
        page.evaluate("applyTheme('cyberpunk')")
        time.sleep(1)
        
        # Screenshot 6: Cyberpunk Theme board
        p6 = os.path.join(screenshot_dir, "weaver_06_cyberpunk_theme.png")
        page.screenshot(path=p6)
        print(f"Screenshot saved: {p6}")

        browser.close()
        print("Playwright script finished successfully!")

except Exception as ex:
    print(f"Error during execution: {ex}")
    import traceback
    traceback.print_exc()

finally:
    # Shutdown server
    server.shutdown()
    server.server_close()
    print("Local HTTP server stopped.")
