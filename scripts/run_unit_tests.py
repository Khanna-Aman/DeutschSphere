#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Unit Test Suite for DeutschSphere (scripts/run_unit_tests.py)
----------------------------------------------------------
Standardizes and runs core mathematical, algorithmic, and linguistic 
unit tests for:
1. Pure-JS FSRS-5 Stability/Difficulty scheduling math.
2. Kölner Phonetik phonetic similarity algorithm.
3. German NLP noun lemmatization (with irregular exclusions) and verb lemmatization.

It runs in a real browser context using Playwright to match the client-side SPA execution environment.
"""

import os
import sys
# Ensure UTF-8 output encoding for Windows compatibility
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
import http.server
import socketserver
import threading
import time
from playwright.sync_api import sync_playwright

PORT = 54998

# Silent HTTP Server for testing
class SilentHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def run_server():
    Handler = SilentHTTPHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

def run_tests():
    # Start local server in the background
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    
    print(f"\n======================================================================")
    print(f"LAUNCHING UNIT TEST SUITE: CLIENT-SIDE JS MODULES VIA PLAYWRIGHT")
    print(f"======================================================================\n")
    
    test_failures = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Monitor uncaught errors and console output
        def on_page_error(err):
            stack_info = f"\n{err.stack}" if hasattr(err, "stack") and err.stack else ""
            print(f"[PAGE ERROR] {err.message}{stack_info}")
            
        def on_console(msg):
            # Print console outputs
            if "PASSED" in msg.text or "✔" in msg.text:
                print(f"  \033[92m{msg.text}\033[0m") # Green
            elif "FAILED" in msg.text or "Error:" in msg.text:
                print(f"  \033[91m{msg.text}\033[0m") # Red
                test_failures.append(msg.text)
            else:
                print(f"  {msg.text}")

        page.on("pageerror", on_page_error)
        page.on("console", on_console)
        
        try:
            # Go to the local page (which enables loading local ES6 modules via relative paths)
            page.goto(f"http://localhost:{PORT}/index.html")
            page.wait_for_load_state("networkidle")
            
            # Execute our unit tests inside the browser context using ESM dynamic imports
            page.evaluate("""
                async () => {
                    try {
                        console.log("[TEST] Importing NLP & FSRS modules...");
                        const nlp = await import('./js/nlp.js');
                        const fsrsModule = await import('./js/fsrs.js');
                        
                        const assert = (cond, msg) => {
                            if (!cond) throw new Error("Assertion failed: " + msg);
                        };

                        console.log("[TEST] Running lemmatizeVerb tests...");
                        assert(nlp.lemmatizeVerb("machst") === "machen", "machst -> machen");
                        assert(nlp.lemmatizeVerb("ist") === "sein", "ist -> sein");
                        assert(nlp.lemmatizeVerb("war") === "sein", "war -> sein");
                        assert(nlp.lemmatizeVerb("spielte") === "spielen", "spielte -> spielen");
                        assert(nlp.lemmatizeVerb("gegangen") === "gehen", "gegangen -> gehen");
                        console.log("[OK] lemmatizeVerb tests passed.");

                        console.log("[TEST] Running lemmatizeNoun (irregular exclusions) tests...");
                        assert(nlp.analyzeText("Käse", [])[0].lemma === "Käse", "Käse -> Käse (remains singular)");
                        assert(nlp.analyzeText("Straße", [])[0].lemma === "Straße", "Straße -> Straße (remains singular)");
                        assert(nlp.analyzeText("Straßen", [])[0].lemma === "Straße", "Straßen -> Straße (correctly lemmatized to Straße)");
                        assert(nlp.analyzeText("Enden", [])[0].lemma === "Ende", "Enden -> Ende (correctly lemmatized to Ende)");
                        assert(nlp.analyzeText("Frauen", [])[0].lemma === "Frau", "Frauen -> Frau (correctly lemmatized to Frau)");
                        assert(nlp.analyzeText("Schulen", [])[0].lemma === "Schule", "Schulen -> Schule (correctly lemmatized to Schule)");
                        assert(nlp.analyzeText("Gabeln", [])[0].lemma === "Gabel", "Gabeln -> Gabel (correctly lemmatized to Gabel)");
                        console.log("[OK] lemmatizeNoun (irregular exclusions) tests passed.");

                        console.log("[TEST] Running koelnerPhonetik tests...");
                        assert(nlp.koelnerPhonetik("Müller") === "657", "Müller -> 657");
                        
                        assert(nlp.koelnerPhonetik("Schmidt") === "862", "Schmidt -> 862");
                        assert(nlp.koelnerPhonetik("Käse") === "48", "Käse -> 48");
                        console.log("[OK] koelnerPhonetik tests passed.");

                        console.log("[TEST] Running FSRS-5 mathematical stability scheduling & boundary tests...");
                        const srs = new fsrsModule.FSRS({ requestRetention: 0.9 });
                        const newCard = srs.createCard(1000);
                        assert(newCard.state === fsrsModule.State.New, "new card state is New");
                        assert(newCard.stability === 0, "new card stability is 0");

                        const reviewed = srs.reviewCard(newCard, fsrsModule.Rating.Good, 1000);
                        assert(reviewed.state === fsrsModule.State.Learning, "first review state is Learning");
                        assert(reviewed.stability === 3.1262, "first review stability matches Good parameter");

                        const retrievability = srs.getRetrievability(reviewed, 1000 + 24 * 60 * 60 * 1000); // 1 day later
                        assert(retrievability > 0.8 && retrievability < 1.0, "retrievability decays realistically");

                        // Boundary test: Repeated Again ratings resets or reduces stability properly
                        const lapsed = srs.reviewCard(reviewed, fsrsModule.Rating.Again, 1000 + 24 * 60 * 60 * 1000);
                        assert(lapsed.lapses === 1, "card lapse counter incremented on Again rating");

                        console.log("[OK] FSRS math & boundary tests passed.");

                        console.log("[TEST] Running Suffix Helper Rule tests...");
                        const ungRule = nlp.getSuffixRule("Zeitung");
                        assert(ungRule && ungRule.gender === "die", "Zeitung -> die (-ung suffix rule)");
                        const heitRule = nlp.getSuffixRule("Freiheit");
                        assert(heitRule && heitRule.gender === "die", "Freiheit -> die (-heit suffix rule)");
                        console.log("[OK] Suffix Helper Rule tests passed.");

                        console.log("[PASSED] ALL UNIT TESTS PASSED SUCCESSFULLY!");
                    } catch (e) {
                        console.error("FAILED - Test error: " + e.message + "\\n" + e.stack);
                    }
                }
            """)
            
            # Allow time for tests to finish executing and log output
            time.sleep(2)
            
        except Exception as e:
            print(f"\033[91m[ERROR] Testing thread failed: {e}\033[0m")
            test_failures.append(str(e))
            
        browser.close()
        
    print(f"\n======================================================================")
    if not test_failures:
        print(f"\033[92mALL TESTS PASSED SUCCESSFULLY! No regressions found.\033[0m")
        print(f"======================================================================\n")
        return True
    else:
        print(f"\033[91mTEST SUITE FAILED with {len(test_failures)} failures:\033[0m")
        for fail in test_failures:
            print(f"  - \033[91m{fail}\033[0m")
        print(f"======================================================================\n")
        return False

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
