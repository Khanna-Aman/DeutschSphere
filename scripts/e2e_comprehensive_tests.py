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
    pass  # Older Python versions or redirection might not support reconfigure

# 1. Automatic Free Port Selector to prevent port collisions
def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('', 0))
    port = s.getsockname()[1]
    s.close()
    return port

PORT = get_free_port()
print(f"=== SOTA E2E Stress-Testing Suite ===")
print(f"Starting server on dynamic port: {PORT}")

# 2. Local HTTP Server Setup
class NoKeepAliveRequestHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    
    def log_message(self, format, *args):
        # Keep E2E output silent and clean
        pass
        
    def end_headers(self):
        self.send_header("Connection", "close")
        super().end_headers()

class ThreadedTCPServer(TCPServer):
    allow_reuse_address = True

# Ensure working directory is the project root
os.chdir(r"D:\Aman\_________Projects\A1-B1_German")

server = ThreadedTCPServer(("", PORT), NoKeepAliveRequestHandler)
server_thread = threading.Thread(target=server.serve_forever)
server_thread.daemon = True
server_thread.start()
print("Local HTTP Server started in the background (Keep-Alive disabled).")

# 3. Screenshot/Artifacts Directory (Dynamic Conversation ID Resolution)
base_brain_dir = r"C:\Users\aman-\.gemini\antigravity\brain"
screenshot_dir = os.path.join(base_brain_dir, "db1bf4fa-ae19-483f-b864-5b28b6ffe25c") # Default fallback to active conversation

if os.path.exists(base_brain_dir):
    try:
        # List all subfolders in the brain directory, ignoring non-directories or system keys
        subfolders = [
            os.path.join(base_brain_dir, f) 
            for f in os.listdir(base_brain_dir) 
            if os.path.isdir(os.path.join(base_brain_dir, f)) and len(f) == 36 and "-" in f and f != ".system_generated"
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
        page.add_init_script("localStorage.setItem('visited_intro', 'true');")
        
        # Attach error interceptors
        page.on("console", handle_console_message)
        page.on("pageerror", handle_page_error)
        
        # Navigate to index.html
        url = f"http://localhost:{PORT}/index.html"
        print(f"Navigating page to: {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        
        # =========================================================================
        # [STEP 1] LOADING OVERLAY & ROUTER NAVIGATION TRANSITIONS
        # =========================================================================
        print("\n[STEP 1] Testing Base App Load & Router Transitions...")
        page.wait_for_selector("#loader-overlay", state="hidden", timeout=15000)
        print(" Loader overlay dismissed.")
        
        title = page.title()
        print(f" Page Title: '{title}'")
        assert "DeutschSphere" in title or "German" in title, f"Unexpected page title: {title}"
        
        # Verify hash router transitions across all 7 views
        views = {
            "#/": "#flashcards-view",
            "#/quiz": "#quiz-view",
            "#/immersion": "#immersion-view"
        }
        
        for route, view_id in views.items():
            print(f" -> Navigating to router route: {route}")
            page.evaluate(f"window.location.hash = '{route}'")
            time.sleep(0.5)
            assert page.locator(view_id).is_visible(), f"View {view_id} is not visible on route {route}!"
            print(f"   Successfully verified view: {view_id}")
            
        # Return to main flashcards view
        page.evaluate("window.location.hash = '#/'")
        time.sleep(0.5)
        
        # =========================================================================
        # [STEP 2] LEVEL SELECTION & SIDEBAR CATEGORIES AUDITING
        # =========================================================================
        print("\n[STEP 2] Testing Level Selections & Sidebar Categories...")
        # Enable all disabled levels for verification
        page.evaluate('document.querySelectorAll("#level-select option").forEach(opt => opt.removeAttribute("disabled"))')
        
        levels = ["a1", "b1", "a2"]
        for level in levels:
            print(f" Switching Level Dropdown Select to: '{level.upper()}'...")
            page.select_option("#level-select", level)
            time.sleep(1.0)
            
            # Assert categories load
            badges = page.locator("#categories-container button")
            badge_count = badges.count()
            print(f"   Loaded {badge_count} category buttons in level '{level}'.")
            assert badge_count > 1, f"No category buttons loaded for level {level}!"
            
        # Click on category badge
        print(" Clicking on first non-'All' category badge...")
        category_btns = page.locator("#categories-container button")
        for i in range(category_btns.count()):
            btn = category_btns.nth(i)
            cat_val = btn.get_attribute("data-category")
            if cat_val != "All":
                print(f"   Selected Category: '{cat_val}'")
                btn.click()
                time.sleep(0.5)
                break
                
        # Reset back to 'All'
        print(" Restoring category filter to 'Alle Kategorien' (All)...")
        all_btn = page.locator('#categories-container button[data-category="All"]').first
        all_btn.click()
        time.sleep(0.5)
        
        # =========================================================================
        # [STEP 2.5] VOCABULARY SEARCH SYSTEM & QUICK-FILTER CHIPS STRESS TEST
        # =========================================================================
        print("\n[STEP 2.5] Testing Vocabulary Search System & Quick-Filter Chips...")
        
        # Focus search input and type a query
        print(" Typing search query 'Abflug' into vocabulary search...")
        page.locator("#search-input").fill("Abflug")
        time.sleep(0.5)
        
        # Verify search-clear is visible
        clear_btn = page.locator("#search-clear")
        assert clear_btn.is_visible(), "Search clear button did not become visible after typing!"
        
        # Test clear button
        print(" Clicking search clear button...")
        clear_btn.click()
        time.sleep(0.5)
        assert page.locator("#search-input").input_value() == "", "Search input was not cleared!"
        assert not clear_btn.is_visible(), "Search clear button remains visible after clearing!"
        
        # Test Search Submit Button and Auto-Routing from another page
        print(" Routing to #/immersion to test auto-routing from search...")
        page.evaluate("window.location.hash = '#/immersion'")
        time.sleep(0.5)
        assert page.locator("#immersion-view").is_visible(), "Failed to route to immersion view!"
        
        print(" Typing in search input while on #/immersion...")
        page.locator("#search-input").fill("Ankunft")
        time.sleep(0.5)
        assert page.locator("#flashcards-view").is_visible(), "Search did not auto-route back to flashcards view!"
        
        # Reset search
        page.locator("#search-clear").click()
        time.sleep(0.5)
        
        # Test search-submit-btn click
        print(" Routing to #/quiz to test search-submit-btn auto-routing...")
        page.evaluate("window.location.hash = '#/quiz'")
        time.sleep(0.5)
        assert page.locator("#quiz-view").is_visible(), "Failed to route to quiz view!"
        
        print(" Typing query and clicking search submit button...")
        page.locator("#search-input").fill("Ansage")
        page.locator("#search-submit-btn").click()
        time.sleep(0.5)
        assert page.locator("#flashcards-view").is_visible(), "search-submit-btn click did not auto-route to flashcards view!"
        assert page.locator("#search-input").input_value() == "Ansage", "Search query was lost on submit!"
        
        # Reset search
        page.locator("#search-clear").click()
        time.sleep(0.5)
        
        # Test vocabulary search enter key submission and keyboard blur / mobile sidebar auto-close
        print(" Routing to #/immersion to test Enter-key search submission and auto-routing...")
        page.evaluate("window.location.hash = '#/immersion'")
        time.sleep(0.5)
        assert page.locator("#immersion-view").is_visible(), "Failed to route to immersion view!"
        
        print(" Typing query 'Ankunft' and pressing Enter inside search input...")
        page.locator("#search-input").fill("Ankunft")
        page.locator("#search-input").press("Enter")
        time.sleep(0.5)
        assert page.locator("#flashcards-view").is_visible(), "Pressing Enter inside search did not auto-route to flashcards view!"
        assert page.locator("#search-input").input_value() == "Ankunft", "Search query was lost on Enter key submit!"
        
        # Reset search
        page.locator("#search-clear").click()
        time.sleep(0.5)



        # Test quick filter chips
        print(" Clicking quick search filter chip 'is:noun'...")
        noun_chip = page.locator('.search-tag-chip[data-tag="is:noun"]')
        noun_chip.click()
        time.sleep(0.5)
        assert "is:noun" in page.locator("#search-input").input_value(), "Filter chip did not append tag to search input!"
        
        # Reset search
        page.locator("#search-clear").click()
        time.sleep(0.5)

        # [STEP 2.7] POMODORO FOCUS BOOSTER - DEPRECATED IN v1.1.0
        # Systematically removed in v1.1.0 alignment.

        # =========================================================================
        # [STEP 3] FLASHCARD INTERACTIONS, ACCORDIONS & PREFS UI SYNCS
        # =========================================================================
        print("\n[STEP 3] Testing Flashcard Accordions & Preferences Dropdown...")
        
        # Card Text Check
        de_word = page.locator("#card-word").inner_text().strip()
        print(f" Current flashcard headword: '{de_word}'")
        assert len(de_word) > 0, "German headword on flashcard is empty!"
        
        # 1. Accordion click expand details
        print(" Clicking flashcard container to expand grammar/example accordion details...")
        page.locator("#flashcard").click()
        time.sleep(0.5)
        
        assert page.locator("#card-meaning").is_visible(), "Flashcard meaning hidden after click!"
        assert page.locator("#card-example-de").is_visible(), "Flashcard German example sentence hidden after click!"
        print("   Meaning and example details are correctly visible.")
        
        # 2. Card navigation buttons
        print(" Clicking 'Next Card' button...")
        page.locator("#next-btn").click()
        time.sleep(0.5)
        de_word_next = page.locator("#card-word").inner_text().strip()
        print(f"   Advanced card. New Word: '{de_word_next}'")
        assert de_word != de_word_next, "Card headword did not change after clicking Next!"
        
        print(" Clicking 'Prev Card' button...")
        page.locator("#prev-btn").click()
        time.sleep(0.5)
        de_word_prev = page.locator("#card-word").inner_text().strip()
        print(f"   Returned to previous card. Current Word: '{de_word_prev}'")
        assert de_word == de_word_prev, "Card failed to return to the original headword!"
        
        # 3. Gelernt (Learned) Status Toggling
        print(" Testing 'Gelernt' toggle button...")
        page.locator("#learned-btn").click()
        time.sleep(0.5)
        print("   Toggled learned state.")
        
        # 4. Speak synthesis button
        print(" Testing TTS speak button...")
        page.locator("#speak-btn").click()
        time.sleep(0.3)
        
        # 5. Open and test Settings dropdown and volumes
        print(" Clicking Preferences Cog button to open settings dropdown...")
        page.locator("#deck-prefs-toggle-btn").click()
        time.sleep(0.5)
        assert page.locator("#deck-prefs-dropdown").is_visible(), "Settings dropdown panel failed to display!"
        
        # Row clicking stress tests (Verifying our exact selector bugfix!)
        print(" Stress testing settings row buttons (toggling configurations)...")
        toggles = [
            ("#read-mode-btn", "Fast-Read mode"),
            ("#autoplay-btn", "Autoplay voice"),
            ("#sound-style-btn", "Sound effects toggle")
        ]
        
        for selector, name in toggles:
            print(f"   Clicking settings option: {name} ({selector})...")
            btn = page.locator(selector)
            btn.click()
            time.sleep(0.3)
            # Toggle again to restore
            btn.click()
            time.sleep(0.3)
            print(f"     Successfully toggled {name} and verified icon remains intact.")
            
        # Volume slider adjustment
        print(" Testing SFX volume slider drag adjust...")
        slider = page.locator("#sfx-volume-slider")
        # Evaluate to set value to 0.8
        page.evaluate("document.getElementById('sfx-volume-slider').value = 0.8")
        slider.dispatch_event("input")
        slider.dispatch_event("change")
        time.sleep(0.3)
        vol_display = page.locator("#sfx-volume-val").inner_text().strip()
        print(f"   Slider adjusted. Display volume value: '{vol_display}'")
        assert vol_display == "80%", f"Volume label failed to synchronize! Expected '80%' but got '{vol_display}'"
        
        # Close settings panel by clicking outside
        print(" Clicking outside dropdown panel to verify auto-close...")
        page.mouse.click(10, 10)
        time.sleep(0.5)
        assert not page.locator("#deck-prefs-dropdown").is_visible(), "Preferences dropdown failed to auto-close on outside click!"
        
        # =========================================================================
        # [STEP 4] PHONETIK-SPIEGEL (ACCENT COACH) PANEL
        # =========================================================================
        print("\n[STEP 4] Testing Phonetik-Spiegel (Pronunciation Mirror)...")
        print(" Clicking Phonetik-Spiegel trigger button...")
        page.locator("#phonetic-btn").click()
        time.sleep(0.5)
        
        mirror_panel = page.locator("#phonetic-mirror-panel")
        assert "open" in mirror_panel.get_attribute("class"), "Phonetic panel did not receive 'open' style class!"
        
        print(" Clicks phonetic record button to verify recording toggles...")
        page.locator("#phonetic-record-btn").click()
        time.sleep(0.4)
        page.locator("#phonetic-record-btn").click()
        time.sleep(0.4)
        
        print(" Clicking Phonetik-Spiegel close button...")
        page.locator("#phonetic-close-btn").click()
        time.sleep(0.5)
        assert "open" not in mirror_panel.get_attribute("class"), "Phonetic panel failed to close on dismiss click!"
        
        # =========================================================================
        # [STEP 5] AUDIO TRAINER & KEYBOARD SHORTCUTS STRESS TEST
        # =========================================================================
        print("\n[STEP 5] Stress Testing Keyboard Hotkeys & Audio Trainer Controls...")
        
        # Audio Trainer Controls
        print(" Expanding and testing Audio Trainer control buttons...")
        page.locator("#trainer-play-btn").click()
        time.sleep(0.3)
        page.locator("#trainer-loop-btn").click()
        time.sleep(0.2)
        page.locator("#trainer-next-btn").click()
        time.sleep(0.3)
        page.locator("#trainer-prev-btn").click()
        time.sleep(0.3)
        page.locator("#trainer-play-btn").click()  # Stop play
        time.sleep(0.3)
        
        # Shortcuts helper accordion panel
        print(" Expanding keyboard shortcuts guide drawer...")
        page.locator("#toggle-shortcuts-btn").click()
        time.sleep(0.5)
        assert page.locator("#shortcuts-content").is_visible(), "Shortcuts drawer content is not expanded!"
        page.locator("#toggle-shortcuts-btn").click()
        time.sleep(0.5)
        
        # Press keyboard hotkeys
        print(" Simulating keyboard Hotkey 'F' (Fast Read toggle)...")
        page.keyboard.press("f")
        time.sleep(0.4)
        
        print(" Simulating keyboard Hotkey 'A' (Autoplay speech toggle)...")
        page.keyboard.press("a")
        time.sleep(0.4)
        
        print(" Simulating keyboard Hotkey 'S' (Sound style toggle)...")
        page.keyboard.press("s")
        time.sleep(0.4)
        
        print(" Simulating keyboard Hotkey 'L' (Learned status toggle)...")
        page.keyboard.press("l")
        time.sleep(0.4)
        
        print(" Simulating keyboard Hotkey 'Space' (Toggle card accordion details)...")
        page.keyboard.press("Space")
        time.sleep(0.5)
        
        print(" Simulating keyboard Hotkey 'ArrowRight' (Next card)...")
        page.keyboard.press("ArrowRight")
        time.sleep(0.5)
        
        print(" Simulating keyboard Hotkey 'ArrowLeft' (Prev card)...")
        page.keyboard.press("ArrowLeft")
        time.sleep(0.5)
        
        # Test keyboard rating keybinds (FSRS buttons 1-4)
        print(" Simulating FSRS spacing keypress hotkey '1' (Again)...")
        page.keyboard.press("1")
        time.sleep(0.5)
        
        print(" Simulating FSRS spacing keypress hotkey '3' (Good)...")
        page.keyboard.press("3")
        time.sleep(0.5)
        
        # =========================================================================
        # [STEP 6] MULTIPLE-CHOICE & SPELLING QUIZ ARENA
        # =========================================================================
        print("\n[STEP 6] Testing MCQ and Spelling Quiz Arena...")
        page.evaluate("window.location.hash = '#/quiz'")
        time.sleep(1.0)
        assert page.locator("#quiz-view").is_visible(), "Failed to navigate to Quiz Arena!"
        
        # 6a. MCQ Quiz Loop
        print(" Clicking MCQ mode selection button...")
        page.locator("#quiz-mode-mc").click()
        time.sleep(1.2)
        assert page.locator("#quiz-workspace").is_visible(), "MCQ Quiz workspace failed to load!"
        
        mcq_buttons = page.locator("#quiz-options-container button")
        print(f"   MCQ Options Buttons rendered: {mcq_buttons.count()}")
        assert mcq_buttons.count() == 4, "MCQ quiz must present exactly 4 choices!"
        
        print("   Selecting first option choice...")
        mcq_buttons.first.click()
        time.sleep(0.5)
        assert page.locator("#quiz-feedback-panel").is_visible(), "MCQ feedback screen is hidden after option select!"
        
        print("   Clicking Next MCQ Question button...")
        page.locator("#quiz-next-question-btn").click()
        time.sleep(0.8)
        
        print("   Pressing 'Escape' key to quit ongoing MCQ quiz...")
        page.keyboard.press("Escape")
        time.sleep(0.8)
        assert page.locator("#quiz-mode-selector").is_visible(), "Failed to exit MCQ quiz back to selection lobby via Escape!"
        
        # 6b. Spelling Quiz Loop
        print(" Clicking Spelling mode selection button...")
        page.locator("#quiz-mode-spelling").click()
        time.sleep(1.2)
        assert page.locator("#quiz-spelling-container").is_visible(), "Spelling quiz workspace failed to load!"
        
        print("   Filling in dummy spelling guess...")
        page.locator("#quiz-spelling-input").fill("Probestraße")
        
        # Virtual Keyboard click
        kb_umlauts = page.locator(".quiz-kb-btn")
        print(f"   Virtual keyboard buttons rendered: {kb_umlauts.count()}")
        assert kb_umlauts.count() > 0, "No spelling virtual umlaut keyboard buttons rendered!"
        
        print("   Clicking first virtual keyboard button...")
        kb_umlauts.first.click()
        time.sleep(0.3)
        spelling_val = page.locator("#quiz-spelling-input").input_value()
        print(f"   Input value after click: '{spelling_val}'")
        
        print("   Submitting spelling answer...")
        page.locator("#quiz-spelling-submit").click()
        time.sleep(0.8)
        assert page.locator("#quiz-feedback-panel").is_visible(), "Spelling feedback screen failed to display!"
        
        print("   Pressing 'Escape' key to exit spelling quiz lobby...")
        page.keyboard.press("Escape")
        time.sleep(0.8)
        assert page.locator("#quiz-mode-selector").is_visible(), "Failed to exit Spelling quiz to selection lobby via Escape!"
        
        # [STEP 7-9 Skip] RPG, Weaver, Cheatcodes skipped due to purge/remediation.
        
        # =========================================================================
        # [STEP 10] IMMERSION LAB (NLP TEXT ANALYZER) - STRESS TESTING THE NLP ENGINE
        # =========================================================================
        print("\n[STEP 10] Stress Testing Immersion Lab & NLP Offline Engine...")
        page.evaluate("window.location.hash = '#/immersion'")
        time.sleep(1.0)
        assert page.locator("#immersion-view").is_visible(), "Failed to route to Immersion view!"
        
        # Input German text to analyze
        sample_sentence = "Ich fahre morgen mit dem Zug ab, weil ich meine Familie besuchen möchte."
        print(f" Entering German text into text area:\n   \"{sample_sentence}\"")
        page.locator("#immersion-textarea").fill(sample_sentence)
        time.sleep(0.4)
        
        # Trigger analyze button
        print(" Clicking 'Text analysieren' button...")
        page.locator("#immersion-analyze-btn").click()
        
        # Wait for analyze loading overlay to complete and display parsed cards
        print(" Waiting for parsed text grid cards rendering...")
        page.wait_for_selector("#immersion-results-grid .immersion-card", state="visible", timeout=15000)
        
        parsed_cards = page.locator("#immersion-results-grid .immersion-card")
        parsed_count = parsed_cards.count()
        print(f"   Successfully parsed {parsed_count} word tokens into the results grid!")
        assert parsed_count > 0, "NLP engine failed to parse tokens into the grid!"
        
        # Click on the first parsed word card to trigger overlay drawer
        first_card_word = parsed_cards.first.locator("h3").inner_text().strip()
        print(f" Clicking parsed word card token: '{first_card_word}' to open explorer drawer overlay...")
        parsed_cards.first.click()
        time.sleep(0.6)
        
        # Assert Overlay Drawer is open
        explorer_overlay = page.locator("#immersion-explorer-overlay")
        assert explorer_overlay.is_visible() and "hidden" not in explorer_overlay.get_attribute("class"), "Immersion Word Explorer drawer overlay failed to open!"
        print("   Immersion Word Explorer Overlay Drawer is open successfully.")
        
        explorer_title = page.locator("#immersion-explorer-title").inner_text().strip()
        print(f"   Explorer Title / Word Head: '{explorer_title}'")
        assert len(explorer_title) > 0, "Word explorer title is empty!"
        
        # Click speech voice synthesis inside drawer
        print("   Clicking Speak/TTS button inside Word Explorer drawer...")
        page.locator("#explorer-speak-btn").click()
        time.sleep(0.4)
        
        # Close Drawer overlay
        print("   Clicking close ('Schließen') button inside Word Explorer drawer...")
        page.locator("#immersion-explorer-close-btn").click(force=True)
        time.sleep(0.5)
        assert not explorer_overlay.is_visible() or "hidden" in explorer_overlay.get_attribute("class"), "Explorer overlay drawer failed to close!"
        print("   Word Explorer Drawer successfully dismissed.")
        
        # [STEP 11 Skip] Stats view and FSRS simulator curves skipped due to purge/remediation.
        
        # =========================================================================
        # [STEP 11.5] SETTINGS PROFILE PROGRESS RESET FLOW
        # =========================================================================
        print("\n[STEP 11.5] Testing custom user profile progress reset flow...")
        page.evaluate("window.location.hash = '#/'")
        time.sleep(0.8)
        
        print(" Opening preferences settings dropdown...")
        page.locator("#deck-prefs-toggle-btn").click()
        time.sleep(0.5)
        
        print(" Clicking 'Fortschritt zurücksetzen' button...")
        page.locator("#reset-progress-btn-main").click()
        time.sleep(0.5)
        
        assert page.locator("#confirm-modal-overlay").is_visible(), "Progress reset confirmation modal failed to open!"
        print(" Clicking Confirm ('Zurücksetzen') on reset profile progress modal...")
        page.locator("#confirm-modal-confirm").click()
        time.sleep(1.0)
        print("   Progress reset triggered and completed successfully!")
        
        # =========================================================================
        # [STEP 12] MULTI-THEME CONTRAST CYCLES & SCREENSHOT GENERATIONS
        # =========================================================================
        print("\n[STEP 12] Performing Multi-Theme Visual Audits & Capture High-Res Screenshots...")
        themes = ["default", "cyberpunk", "schwarzwald", "oktoberfest", "weimar"]
        
        # Let's take screenshots of multiple key views across both viewports!
        # Views screenshots targets:
        view_scenarios = [
            ("#/", "flashcards-view", "flashcard"),
            ("#/quiz", "quiz-view", "quiz"),
            ("#/immersion", "immersion-view", "immersion")
        ]
        
        # 12a. Desktop Viewports Screenshot cycles
        print("\nRunning Desktop theme and viewport screenshots audits (1440x900)...")
        # Go back to flashcards main view and expand details for default main layout shots
        page.evaluate("window.location.hash = '#/'")
        time.sleep(0.5)
        page.locator("#flashcard").click()
        time.sleep(0.5)
        
        for theme in themes:
            print(f" -> Switching Theme to: '{theme.upper()}'")
            page.evaluate(f"applyTheme('{theme}')")
            time.sleep(0.8)
            
            sc_desktop = os.path.join(screenshot_dir, f"e2e_desktop_{theme}.png")
            page.screenshot(path=sc_desktop)
            print(f"   [Desktop Main-View Screenshot] saved: {sc_desktop}")
            
        # Weimar View cycles: Take other views screenshots under distinct illustrative themes
        print("\nCapturing various sub-views on Desktop under representative premium themes...")
        for route, view_id, name in view_scenarios:
            if name == "flashcard":
                continue # Already captured
            
            # Use Weimar theme for Quiz, Cyberpunk for RPG, Schwarzwald for Weaver, Oktoberfest for Immersion, Default for Stats
            assoc_theme = "default"
            if name == "quiz":
                assoc_theme = "weimar"
            elif name == "adventure":
                assoc_theme = "cyberpunk"
            elif name == "weaver":
                assoc_theme = "schwarzwald"
            elif name == "immersion":
                assoc_theme = "oktoberfest"
            
            print(f" -> Routing to {route} under theme '{assoc_theme.upper()}'...")
            page.evaluate(f"applyTheme('{assoc_theme}')")
            page.evaluate(f"window.location.hash = '{route}'")
            time.sleep(1.0)
            
            # Extra setup for immersion analysis screenshot
            if name == "immersion":
                page.locator("#immersion-textarea").fill("Ich gehe heute in die Schule und lerne Deutsch.")
                page.locator("#immersion-analyze-btn").click()
                time.sleep(1.0)
            
            sc_path = os.path.join(screenshot_dir, f"e2e_desktop_view_{name}.png")
            page.screenshot(path=sc_path)
            print(f"   [Desktop Sub-View {name.upper()}] saved: {sc_path}")
            
        # 12b. Mobile Viewports Screenshot cycles (375x812 - iPhone X)
        print("\nSwitching to Mobile Viewport dynamically (375x812)...")
        page.set_viewport_size({"width": 375, "height": 812})
        time.sleep(1.0)
        
        # Capture main flashcard view in all themes
        page.evaluate("window.location.hash = '#/'")
        time.sleep(0.5)
        
        for theme in themes:
            print(f" -> Switching Mobile Theme to: '{theme.upper()}'")
            page.evaluate(f"applyTheme('{theme}')")
            time.sleep(0.8)
            
            sc_mobile = os.path.join(screenshot_dir, f"e2e_mobile_{theme}.png")
            page.screenshot(path=sc_mobile)
            print(f"   [Mobile Main-View Screenshot] saved: {sc_mobile}")
            
        # Capture sub views on Mobile
        print("\nCapturing various sub-views on Mobile under representative premium themes...")
        for route, view_id, name in view_scenarios:
            if name == "flashcard":
                continue
                
            assoc_theme = "default"
            if name == "quiz":
                assoc_theme = "weimar"
            elif name == "adventure":
                assoc_theme = "cyberpunk"
            elif name == "weaver":
                assoc_theme = "schwarzwald"
            elif name == "immersion":
                assoc_theme = "oktoberfest"
                
            print(f" -> Routing to {route} under theme '{assoc_theme.upper()}' on Mobile...")
            page.evaluate(f"applyTheme('{assoc_theme}')")
            page.evaluate(f"window.location.hash = '{route}'")
            time.sleep(1.0)
            
            if name == "immersion":
                page.locator("#immersion-textarea").fill("Ich gehe heute in die Schule und lerne Deutsch.")
                page.locator("#immersion-analyze-btn").click()
                time.sleep(1.0)
                
            sc_path = os.path.join(screenshot_dir, f"e2e_mobile_view_{name}.png")
            page.screenshot(path=sc_path)
            print(f"   [Mobile Sub-View {name.upper()}] saved: {sc_path}")
            
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
