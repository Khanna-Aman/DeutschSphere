import os
import sys
import time
import socket
import threading
import traceback
from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from playwright.sync_api import sync_playwright

# Setup stdout encoding to handle emojis on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass # Older Python versions or redirection might not support reconfigure

# 1. Automatic Free Port Selector
def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('', 0))
    port = s.getsockname()[1]
    s.close()
    return port

PORT = get_free_port()
print(f"=== Comprehensive E2E Testing Suite ===")
print(f"Starting server on dynamic port: {PORT}")

# 2. Local HTTP Server Setup
class ThreadedTCPServer(TCPServer):
    allow_reuse_address = True

# Ensure working directory is the project root
os.chdir(r"D:\Aman\_________Projects\A1-B1_German")

server = ThreadedTCPServer(("", PORT), SimpleHTTPRequestHandler)
server_thread = threading.Thread(target=server.serve_forever)
server_thread.daemon = True
server_thread.start()
print("Local HTTP Server started in the background.")

# 3. Screenshot/Artifacts Directory (Dynamic Conversation ID Resolution)
base_brain_dir = r"C:\Users\aman-\.gemini\antigravity\brain"
screenshot_dir = os.path.join(base_brain_dir, "c9bacab3-d6e0-4e65-afc2-7742676b07f5") # Default fallback to active conversation

if os.path.exists(base_brain_dir):
    try:
        # List all subfolders in the brain directory, ignoring non-directories or system keys
        subfolders = [
            os.path.join(base_brain_dir, f) 
            for f in os.listdir(base_brain_dir) 
            if os.path.isdir(os.path.join(base_brain_dir, f)) and len(f) > 10 and f != ".system_generated"
        ]
        if subfolders:
            # Sort by modification time (most recent first)
            subfolders.sort(key=lambda x: os.path.getmtime(x), reverse=True)
            screenshot_dir = subfolders[0]
            print(f"Dynamically resolved active conversation brain directory: {screenshot_dir}")
    except Exception as e:
        print(f"Error dynamically resolving active brain directory: {e}")

os.makedirs(screenshot_dir, exist_ok=True)


# Tracks captured console errors/page errors
console_errors = []

def handle_console_message(msg):
    msg_text = msg.text.lower()
    
    # Extract URL from location robustly
    url = ""
    if msg.location:
        if isinstance(msg.location, dict):
            url = msg.location.get("url", "").lower()
        elif hasattr(msg.location, "url"):
            try:
                url = str(msg.location.url).lower()
            except Exception:
                pass
                
    # Ignore microphone hardware/access warnings on headless environments
    if "microphone" in msg_text or "notsupportederror" in msg_text or "hardware access blocked" in msg_text:
        print(f" [CONSOLE EXPECTED HARDWARE MSG] {msg.text}")
        return
    # Ignore missing optional assets (SVGs, PNGs, Twemoji, icon, manifest)
    is_optional_asset = (".svg" in url or ".png" in url or "card_" in url or "twemoji" in url or "icon" in url or "manifest" in url or "favicon" in url or ".svg" in msg_text or ".png" in msg_text or "card_" in msg_text)
    if "failed to load" in msg_text and is_optional_asset:
        print(f" [CONSOLE EXPECTED OPTIONAL ASSET WARNING] {msg.text} (URL: {url})")
        return

    if msg.type == "error":
        console_errors.append(f"Console Error: {msg.text} (Location: {msg.location})")
        print(f" [CONSOLE ERROR] {msg.text}")
    elif "exception" in msg_text:
        console_errors.append(f"Console Warning Exception: {msg.text}")
        print(f" [CONSOLE EXCEPTION HINT] {msg_text}")

def handle_page_error(error):
    console_errors.append(f"Page Uncaught Error: {error.message}\nStack: {error.stack}")
    print(f" [UNCAUGHT PAGE ERROR] {error.message}")

success = False

try:
    with sync_playwright() as p:
        print("\n--- Launching Headless Chromium Browser ---")
        browser = p.chromium.launch(headless=True)
        
        # Desktop context
        print("Creating Desktop Browser context (1440x900)...")
        context_desktop = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context_desktop.new_page()
        
        # Attach error interceptors
        page.on("console", handle_console_message)
        page.on("pageerror", handle_page_error)
        
        # Navigate to index.html
        url = f"http://localhost:{PORT}/index.html"
        print(f"Navigating page to: {url}")
        page.goto(url)
        
        # Test Step 1: Base Application & Loading Check
        print("\n[STEP 1] Testing Base App & Offline Load...")
        page.wait_for_selector("#loader-overlay", state="hidden", timeout=15000)
        print(" Loader overlay hidden successfully.")
        
        title = page.title()
        print(f" Page Title: '{title}'")
        assert "A1-B1" in title or "German" in title, "Page Title is incorrect!"
        
        # Ensure level select is visible and populated
        assert page.locator("#level-select").is_visible(), "Level Select is missing!"
        assert page.locator("#theme-select").is_visible(), "Theme Select is missing!"
        
        # Test Step 2: Sidebar Categories & Level Selection Swings
        print("\n[STEP 2] Testing Sidebar Categories & Level Selector...")
        
        # Check that Level dropdown works and switches to A1
        page.select_option("#level-select", "a1")
        time.sleep(1.5)
        print(" Switched Level to A1.")
        
        # Ensure categories are loaded
        categories = page.locator("#categories-container button")
        cat_count = categories.count()
        print(f" Loaded {cat_count} category badges in A1.")
        assert cat_count > 1, "Categories did not load correctly!"
        
        # Switch Level to B1 and check
        page.select_option("#level-select", "b1")
        time.sleep(1.5)
        print(" Switched Level to B1.")
        
        # Switch back to A2 for standard test runs
        page.select_option("#level-select", "a2")
        time.sleep(1.5)
        print(" Switched Level to A2.")
        
        # Click on 'All' category button
        all_cat_btn = page.locator('#categories-container button[data-category="All"]').first
        all_cat_btn.click()
        time.sleep(0.5)
        print(" Category 'Alle Kategorien' selected.")
        
        # Test Step 3: Flashcard Interactions & Preferences Dropdown
        print("\n[STEP 3] Testing Flashcard Loops & Prefs Panel...")
        
        # Read the active German word
        active_word = page.locator("#card-word").inner_text().strip()
        print(f" Active German Word: '{active_word}'")
        assert len(active_word) > 0, "No word displayed on the flashcard!"
        
        # Click flashcard itself to expand details (accordion flip)
        print(" Clicking flashcard to expand accordion details...")
        page.locator("#flashcard").click()
        time.sleep(0.6)
        
        # Check meaning and example are visible
        meaning_visible = page.locator("#card-meaning").is_visible()
        example_visible = page.locator("#card-example-de").is_visible()
        print(f" Details Visible: Meaning={meaning_visible}, German Example={example_visible}")
        assert meaning_visible, "Card Meaning is hidden after flip click!"
        
        # Click next card button
        print(" Clicking 'Next Card' button...")
        page.locator("#next-btn").click()
        time.sleep(0.6)
        new_word = page.locator("#card-word").inner_text().strip()
        print(f" Advanced to next card. New Word: '{new_word}'")
        assert active_word != new_word, "Card did not advance!"
        
        # Click previous card button
        print(" Clicking 'Prev Card' button...")
        page.locator("#prev-btn").click()
        time.sleep(0.6)
        restored_word = page.locator("#card-word").inner_text().strip()
        print(f" Returned back. Current Word: '{restored_word}'")
        assert restored_word == active_word, "Previous card did not return to start!"
        
        # Click mark as Learned button to toggle SRS promotion
        print(" Clicking 'Gelernt' toggle button...")
        page.locator("#learned-btn").click()
        time.sleep(0.5)
        print(" Toggled learned status successfully.")
        
        # Click TTS speech button
        print(" Clicking speech synthesis button...")
        page.locator("#speak-btn").click()
        time.sleep(0.5)
        
        # Open Glassmorphic Preferences Popover
        print(" Clicking Preferences Cog toggle button...")
        page.locator("#deck-prefs-toggle-btn").click()
        time.sleep(0.5)
        
        dropdown_visible = page.locator("#deck-prefs-dropdown").is_visible()
        print(f" Preferences Dropdown Visible: {dropdown_visible}")
        assert dropdown_visible, "Preferences dropdown menu is missing or hidden!"
        
        # Click Fast-Read Mode toggle inside the dropdown
        print(" Clicking 'Fast Read Mode' toggle inside dropdown...")
        page.locator("#read-mode-btn").click()
        time.sleep(0.5)
        
        # Clicking outside to auto-close dropdown
        print(" Clicking outside to close dropdown panel...")
        page.mouse.click(10, 10)
        time.sleep(0.5)
        dropdown_closed = not page.locator("#deck-prefs-dropdown").is_visible()
        print(f" Dropdown successfully closed by click-outside: {dropdown_closed}")
        assert dropdown_closed, "Preferences dropdown failed to auto-close!"
        
        # Open and Close Phonetik-Spiegel Accent Coach
        print(" Opening Phonetik-Spiegel pronunciation coach panel...")
        page.locator("#phonetic-btn").click()
        time.sleep(0.5)
        assert "open" in page.locator("#phonetic-mirror-panel").get_attribute("class"), "Phonetic Mirror panel failed to open!"
        
        # Test clicking phonetic record button to verify micro-animations
        print(" Testing phonetic record button toggle...")
        page.locator("#phonetic-record-btn").click()
        time.sleep(0.5)
        page.locator("#phonetic-record-btn").click()
        time.sleep(0.5)
        
        print(" Closing Phonetik-Spiegel pronunciation coach panel...")
        page.locator("#phonetic-close-btn").click()
        time.sleep(0.5)
        assert "open" not in page.locator("#phonetic-mirror-panel").get_attribute("class"), "Phonetic Mirror panel failed to close!"
        
        # Test Step 3.5: Audio Trainer Panel & Keyboard Shortcuts
        print("\n[STEP 3.5] Testing Audio Trainer Controls & Keyboard Navigation...")
        
        # 1. Expand keyboard shortcuts guide
        print(" Toggling keyboard shortcuts panel...")
        page.locator("#toggle-shortcuts-btn").click()
        time.sleep(0.5)
        assert page.locator("#shortcuts-content").is_visible(), "Shortcuts content failed to expand!"
        page.locator("#toggle-shortcuts-btn").click()
        time.sleep(0.5)
        
        # 2. Test Audio Trainer Panel clicks
        print(" Testing Audio Trainer controls...")
        page.locator("#trainer-play-btn").click()
        time.sleep(0.5)
        page.locator("#trainer-loop-btn").click()
        time.sleep(0.3)
        page.locator("#trainer-next-btn").click()
        time.sleep(0.5)
        page.locator("#trainer-prev-btn").click()
        time.sleep(0.5)
        # Turn off trainer
        page.locator("#trainer-play-btn").click()
        time.sleep(0.5)
        
        # 3. Test Keyboard Shortcuts
        print(" Simulating spacebar keypress to toggle active card accordion...")
        page.keyboard.press("Space")
        time.sleep(0.5)
        
        print(" Simulating ArrowRight keypress to go to next card...")
        page.keyboard.press("ArrowRight")
        time.sleep(0.5)
        
        print(" Simulating ArrowLeft keypress to go back...")
        page.keyboard.press("ArrowLeft")
        time.sleep(0.5)
        
        # Test Step 4: MCQ & Spelling Quiz Arena
        print("\n[STEP 4] Testing Multiple-Choice & Spelling Quiz loops...")
        
        # Navigate to Quiz tab via router hash
        print(" Navigating to hash '#/quiz'...")
        page.evaluate("window.location.hash = '#/quiz'")
        time.sleep(1.0)
        assert page.locator("#quiz-view").is_visible(), "Quiz view failed to render!"
        
        # 4a. MCQ Quiz Loop
        print(" Starting MCQ (Multiple-Choice) quiz mode...")
        page.locator("#quiz-mode-mc").click()
        time.sleep(1.2)
        assert page.locator("#quiz-workspace").is_visible(), "Quiz workspace did not load!"
        
        # Verify MCQ option choices are loaded
        options = page.locator("#quiz-options-container button")
        opt_count = options.count()
        print(f" MCQ Option Buttons visible: {opt_count}")
        assert opt_count == 4, "MCQ quiz mode must render exactly 4 answer options!"
        
        # Click the first answer option button
        print(" Clicking first option chip...")
        options.first.click()
        time.sleep(0.5)
        
        # Feedback screen should show up
        feedback_visible = page.locator("#quiz-feedback-panel").is_visible()
        print(f" MCQ Answer feedback panel visible: {feedback_visible}")
        assert feedback_visible, "No feedback panel revealed after selecting MCQ option!"
        
        # Click Next question
        print(" Advancing quiz to next question...")
        page.locator("#quiz-next-question-btn").click()
        time.sleep(0.8)
        
        # Quit ongoing MCQ quiz via keyboard Escape key shortcut
        print(" Quitting ongoing MCQ quiz via Escape key shortcut...")
        page.keyboard.press("Escape")
        time.sleep(0.8)
        assert page.locator("#quiz-mode-selector").is_visible(), "MCQ Quiz failed to quit via Escape key!"
        
        # 4b. Spelling Quiz Loop
        print(" Starting Spelling quiz mode...")
        page.locator("#quiz-mode-spelling").click()
        time.sleep(1.2)
        assert page.locator("#quiz-spelling-container").is_visible(), "Spelling container did not load!"
        
        # Type a dummy answer
        print(" Typing dummy spelling input...")
        page.locator("#quiz-spelling-input").fill("Dummy-Test")
        
        # Test clicking virtual umlaut keys
        umlauts = page.locator(".quiz-kb-btn")
        umlaut_count = umlauts.count()
        print(f" Virtual Umlaut Keyboard Buttons count: {umlaut_count}")
        assert umlaut_count > 0, "No virtual umlaut keyboard buttons loaded!"
        
        print(" Clicking first virtual umlaut key...")
        umlauts.first.click()
        time.sleep(0.3)
        typed_val = page.locator("#quiz-spelling-input").input_value()
        print(f" Input field value after umlaut click: '{typed_val}'")
        
        # Submit spelling answer
        print(" Submitting spelling answer...")
        page.locator("#quiz-spelling-submit").click()
        time.sleep(0.8)
        
        # Verify feedback
        assert page.locator("#quiz-feedback-panel").is_visible(), "Spelling Answer feedback failed to show!"
        
        # Quit Spelling Quiz via Escape key shortcut
        print(" Quitting Spelling quiz via Escape key shortcut...")
        page.keyboard.press("Escape")
        time.sleep(0.8)
        assert page.locator("#quiz-mode-selector").is_visible(), "Spelling Quiz failed to quit via Escape key!"
        
        # Test Step 4.5: Cheatcodes Panel & Search Verification
        print("\n[STEP 4.5] Testing Cheatcodes Spickzettel and Tab filters...")
        print(" Navigating to hash '#/cheatcodes'...")
        page.evaluate("window.location.hash = '#/cheatcodes'")
        time.sleep(1.0)
        assert page.locator("#cheatcodes-view").is_visible(), "Cheatcodes view failed to render!"
        
        # Search cheatcodes
        print(" Typing search query inside Cheatcodes Search...")
        page.locator("#cheatcode-search").fill("der")
        time.sleep(0.5)
        
        # Click category tabs
        tabs = ["all", "nouns", "prefixes", "adjectives"]
        for tab in tabs:
            print(f" Clicking Cheatcode Tab: {tab}...")
            page.locator(f".cheatcode-tab-btn[data-tab='{tab}']").click()
            time.sleep(0.5)
            
        # Clear search
        page.locator("#cheatcode-search").fill("")
        time.sleep(0.5)
        
        # Test Step 5: RPG Deutsch-Abenteuer (Adventure Mode)
        print("\n[STEP 5] Testing RPG Deutsch-Abenteuer...")
        print(" Navigating to hash '#/adventure'...")
        page.evaluate("window.location.hash = '#/adventure'")
        time.sleep(1.5) # Allow dynamic async fetch to populate scenarios list
        assert page.locator("#adventure-view").is_visible(), "Adventure view failed to render!"
        
        # Ensure scenario cards loaded (using correct hierarchy selector)
        scenarios = page.locator("#adventure-selector > div")
        scen_count = scenarios.count()
        print(f" RPG Scenarios available: {scen_count}")
        assert scen_count > 0, "No adventure scenarios found!"
        
        # Start first available RPG scenario by clicking the card div
        print(" Starting first adventure scenario...")
        scenarios.first.click()
        time.sleep(1.5)
        
        # Check active dialog panel is visible
        assert page.locator("#adventure-board").is_visible(), "Adventure game board failed to start!"
        
        # NPC speaker text bubble should exist
        npc_text = page.locator("#adventure-npc-bubble").inner_text()
        print(f" NPC Dialogue speech: '{npc_text}'")
        assert len(npc_text) > 0, "NPC dialog text is empty!"
        
        # Test clicking phonetic speaker button on active scenario
        print(" Clicking NPC voice pronouncer button...")
        page.locator("#adventure-npc-speak-btn").click()
        time.sleep(0.5)
        
        # Verify word chips are loaded
        adv_chips = page.locator("#adventure-chips-pool .adventure-chip")
        adv_chip_count = adv_chips.count()
        print(f" Adventure scrambled word chips in pool: {adv_chip_count}")
        assert adv_chip_count > 0, "No adventure scrambled word chips generated!"
        
        # Click the first chip to snap it to the dropzone
        print(" Snapping first scrambled word chip...")
        adv_chips.first.click()
        time.sleep(0.5)
        
        # Click reset syntax board button
        print(" Clicking reset syntax board button inside Adventure Mode...")
        page.locator("#adventure-reset-btn").click()
        time.sleep(0.5)
        
        # Ensure snapped slot was cleared and chips pool size is restored
        reset_adv_chip_count = page.locator("#adventure-chips-pool .adventure-chip").count()
        print(f" Chips pool size after reset: {reset_adv_chip_count}")
        assert reset_adv_chip_count == adv_chip_count, "Adventure syntax reset failed!"
        
        # Snap again and submit for test coverage
        print(" Snapping first chip again and submitting syntax check...")
        page.locator("#adventure-chips-pool .adventure-chip").first.click()
        time.sleep(0.3)
        page.locator("#adventure-submit-btn").click()
        time.sleep(0.8)
        
        # Quit scenario back to lobby
        print(" Clicking Quit Adventure button...")
        page.locator("#adventure-quit-btn").click()
        time.sleep(0.5)
        
        # Confirm quit on our custom confirm modal
        print(" Clicking confirm on adventure quit custom modal...")
        page.locator("#confirm-modal-confirm").click()
        time.sleep(0.8)
        
        # Test Step 6: Grammatik-Weberei (Weaver Game Board)
        print("\n[STEP 6] Testing Grammatik-Weberei drag-and-snap syntax checker...")
        print(" Navigating to hash '#/weaver'...")
        page.evaluate("window.location.hash = '#/weaver'")
        time.sleep(1.0)
        assert page.locator("#weaver-view").is_visible(), "Grammatik-Weberei view failed to load!"
        
        # Click start
        print(" Clicking Weaver start training button...")
        page.locator("#weaver-start-btn").click()
        time.sleep(1.5)
        assert page.locator("#weaver-board").is_visible(), "Weaver active game board failed to start!"
        
        # Ensure pool of chips and empty targets exist
        chips = page.locator("#weaver-chips-pool .weaver-chip")
        chip_count = chips.count()
        print(f" Scrambled Word Chips in pool: {chip_count}")
        assert chip_count > 0, "No syntax scrambled word chips generated!"
        
        # Click the first chip to test click-to-snap logic
        first_chip_text = chips.first.inner_text().strip()
        print(f" Snapping first scrambled chip: '{first_chip_text}'")
        chips.first.click()
        time.sleep(0.5)
        
        # Verify that reset clears the snapped slots
        print(" Clicking reset syntax board button...")
        page.locator("#weaver-reset-btn").click()
        time.sleep(0.5)
        
        # Snapped slots should return back to active pool
        reset_chip_count = page.locator("#weaver-chips-pool .weaver-chip").count()
        print(f" Chips pool size after reset: {reset_chip_count}")
        assert reset_chip_count == chip_count, "Syntax reset failed to return chips to pool!"
        
        # Click chip again and hit Submit to check verification mechanics
        print(" Snapping first chip and clicking submit syntax check...")
        page.locator("#weaver-chips-pool .weaver-chip").first.click()
        time.sleep(0.3)
        page.locator("#weaver-submit-btn").click()
        time.sleep(0.8)
        
        # Click Quit Weaver game
        print(" Clicking Quit Weaver button...")
        page.locator("#weaver-quit-btn").click()
        time.sleep(0.5)
        
        # Confirm quit on our custom confirm modal
        print(" Clicking confirm on weaver quit custom modal...")
        page.locator("#confirm-modal-confirm").click()
        time.sleep(0.8)
        
        # Test Step 7: Stats Analysis Panel
        print("\n[STEP 7] Testing Stats view & Export backup click...")
        print(" Navigating to hash '#/stats'...")
        page.evaluate("window.location.hash = '#/stats'")
        time.sleep(1.0)
        assert page.locator("#stats-view").is_visible(), "Stats view failed to load!"
        
        # Check overall progress counts and unlocked achievements render
        badges = page.locator("#achievements-grid > div")
        print(f" Achievements grid card nodes: {badges.count()}")
        assert badges.count() > 0, "Achievements grid did not render!"
        
        # Intercept download trigger on Backup Export button click
        print(" Testing backup export trigger...")
        with page.expect_download() as download_info:
            page.locator("#backup-export-btn").click()
        download = download_info.value
        print(f" Backup file download initiated. File name: '{download.suggested_filename}'")
        assert "german_mastery_backup" in download.suggested_filename.lower(), "Suggested backup filename is incorrect!"
        
        # Test Step 7.5: User Progress Reset Flow
        print("\n[STEP 7.5] Testing progress reset confirmation modal flow...")
        
        # Setup dialog handler to accept browser confirmations
        print(" Listening for confirm dialogs...")
        page.once("dialog", lambda dialog: dialog.accept())
        
        # Navigate back to Home hash
        page.evaluate("window.location.hash = '#/'")
        time.sleep(0.8)
        
        print(" Opening Preferences menu...")
        page.locator("#deck-prefs-toggle-btn").click()
        time.sleep(0.5)
        
        print(" Clicking 'Reset Progress' button...")
        page.locator("#reset-progress-btn-main").click()
        time.sleep(0.5)
        
        # Confirm reset on our custom confirm modal
        print(" Clicking confirm on progress reset custom modal...")
        page.locator("#confirm-modal-confirm").click()
        time.sleep(1.0)
        print(" Progress reset executed and accepted successfully!")
        
        # Test Step 8: Multi-Theme Contrast Cycles & Multi-Viewport Screen Audits
        print("\n[STEP 8] Auditing Multi-Theme Contrast & Viewports...")
        themes = ["default", "cyberpunk", "schwarzwald", "oktoberfest", "weimar"]
        
        # Go back to Flashcards main view
        page.evaluate("window.location.hash = '#/'")
        time.sleep(1.0)
        
        # Ensure we expand card details to show Weimar theme text visibility on example elements
        page.locator("#flashcard").click()
        time.sleep(0.5)
        
        for theme in themes:
            print(f" -> Switching Theme to: '{theme.upper()}'")
            page.evaluate(f"applyTheme('{theme}')")
            time.sleep(0.8)
            
            # Save Desktop Screenshot Run
            sc_desktop = os.path.join(screenshot_dir, f"e2e_desktop_{theme}.png")
            page.screenshot(path=sc_desktop)
            print(f"   [Desktop Screenshot] saved: {sc_desktop}")
            
        # Switch to Mobile Viewport dynamically on the same page (375x812 - iPhone X)
        print("\nSwitching to Mobile Viewport dynamically (375x812)...")
        page.set_viewport_size({"width": 375, "height": 812})
        time.sleep(1.0)
        
        for theme in themes:
            print(f" -> Switching Mobile Theme to: '{theme.upper()}'")
            page.evaluate(f"applyTheme('{theme}')")
            time.sleep(0.8)
            
            # Save Mobile Screenshot Run
            sc_mobile = os.path.join(screenshot_dir, f"e2e_mobile_{theme}.png")
            page.screenshot(path=sc_mobile)
            print(f"   [Mobile Screenshot] saved: {sc_mobile}")
            
        print("\nClosing browser...")
        browser.close()
        
        success = True

except Exception as ex:
    print(f"\n[ERROR] E2E TEST CRITICAL FAILURE: {ex}")
    traceback.print_exc()
    try:
        failure_sc = os.path.join(screenshot_dir, "e2e_failure_debug.png")
        page.screenshot(path=failure_sc)
        print(f"Captured failure screenshot: {failure_sc}")
    except Exception as sc_ex:
        print(f"Could not capture failure screenshot: {sc_ex}")

finally:
    # Stop local server
    print("\nShutting down local HTTP server...")
    server.shutdown()
    server.server_close()
    print("Local HTTP Server stopped.")

print("\n=== E2E AUDIT REVIEW SUMMARY ===")
print(f"Caught Console Errors/Exceptions list count: {len(console_errors)}")
for index, err in enumerate(console_errors, 1):
    print(f" {index}. {err}")

if success and len(console_errors) == 0:
    print("\nSUCCESS: All comprehensive E2E user-journey flows executed with clean outcomes (Zero exceptions)!")
    sys.exit(0)
else:
    print("\nFAILURE: Some interactive test cases or console errors were encountered.")
    sys.exit(1)
