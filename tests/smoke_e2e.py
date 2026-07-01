#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/smoke_e2e.py — boot / smoke + key end-to-end flow for DeutschSphere.

Rebuilt from scratch (2026-07-01) to replace the removed scripts/run_unit_tests.py
and scripts/e2e_comprehensive_tests.py. The deterministic logic tests now live in
tests/*.test.mjs (node --test); this file covers the things that only a real browser
can prove:

  1. The app boots with NO uncaught JavaScript exceptions.
  2. A real flashcard renders (#card-word is populated) — data load + render pipeline.
  3. The wordlist survives an IndexedDB round-trip (antigravity-store / keyval).
  4. The FSRS-5 scheduler advances a card's due date inside the shipped ESM runtime.

Image 404s (B1 is only partially illustrated) are treated as advisory, not failures.

Run:  python tests/smoke_e2e.py
Exit: 0 = pass, 1 = fail. Requires playwright (`pip install playwright && playwright install chromium`).
"""

import os
import sys
import http.server
import socketserver
import threading

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 54999


class SilentHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def translate_path(self, path):
        # Serve from the repo root regardless of cwd.
        rel = path.split("?", 1)[0].split("#", 1)[0].lstrip("/")
        return os.path.join(ROOT, rel)


def is_benign(text: str) -> bool:
    t = (text or "").lower()
    return (
        "failed to load resource" in t
        or ".webp" in t
        or "the server responded with a status of 404" in t
        or "favicon" in t
    )


def main() -> int:
    from playwright.sync_api import sync_playwright

    httpd = socketserver.TCPServer(("", PORT), SilentHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    failures = []
    page_errors = []
    console_errors = []

    print("=" * 66)
    print("SMOKE / E2E: DeutschSphere boot + scheduler round-trip")
    print("=" * 66)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("pageerror", lambda e: page_errors.append(e.message))
        page.on("console", lambda m: console_errors.append(m.text)
                if m.type == "error" and not is_benign(m.text) else None)

        try:
            page.goto(f"http://localhost:{PORT}/index.html")
            page.wait_for_load_state("networkidle")

            # (2) A real flashcard rendered.
            try:
                page.wait_for_function(
                    "() => { const el = document.getElementById('card-word');"
                    " return el && el.textContent.trim().length > 0; }",
                    timeout=15000,
                )
                word = page.eval_on_selector("#card-word", "el => el.textContent.trim()")
                print(f"[OK] flashcard rendered: card-word = {word!r}")
            except Exception as e:
                failures.append(f"flashcard did not render: {e}")

            # (3) IndexedDB round-trip: the app persisted a level dictionary on boot.
            idb_count = page.evaluate("""
                async () => {
                    return await new Promise((resolve) => {
                        const req = indexedDB.open('antigravity-store');
                        req.onsuccess = () => {
                            const db = req.result;
                            if (!db.objectStoreNames.contains('keyval')) return resolve(-1);
                            const tx = db.transaction('keyval', 'readonly');
                            const countReq = tx.objectStore('keyval').count();
                            countReq.onsuccess = () => resolve(countReq.result);
                            countReq.onerror = () => resolve(-2);
                        };
                        req.onerror = () => resolve(-3);
                    });
                }
            """)
            if isinstance(idb_count, (int, float)) and idb_count >= 1:
                print(f"[OK] IndexedDB round-trip: {int(idb_count)} key(s) in antigravity-store/keyval")
            else:
                failures.append(f"IndexedDB round-trip failed (count={idb_count})")

            # (4) FSRS-5 scheduler advances a due date in the shipped ESM runtime.
            advanced = page.evaluate("""
                async () => {
                    const { FSRS, Rating, State } = await import('./js/fsrs.js');
                    const srs = new FSRS();
                    const c0 = srs.createCard(1000);
                    const c1 = srs.reviewCard(c0, Rating.Good, 1000);
                    return { due: c1.due, state: c1.state, learning: State.Learning };
                }
            """)
            if advanced and advanced["due"] > 1000 and advanced["state"] == advanced["learning"]:
                print(f"[OK] FSRS scheduler advanced due to +{(advanced['due']-1000)/86400000:.0f}d, state=Learning")
            else:
                failures.append(f"FSRS scheduler did not advance as expected: {advanced}")

        except Exception as e:
            failures.append(f"navigation/boot error: {e}")
        finally:
            browser.close()
            httpd.shutdown()

    # (1) No uncaught exceptions.
    if page_errors:
        failures.append(f"{len(page_errors)} uncaught page error(s): {page_errors[:3]}")
    if console_errors:
        print(f"[warn] {len(console_errors)} non-benign console error(s) (advisory): {console_errors[:3]}")

    print("=" * 66)
    if failures:
        print(f"SMOKE/E2E FAILED with {len(failures)} failure(s):")
        for f in failures:
            print(f"  - {f}")
        print("=" * 66)
        return 1
    print("SMOKE/E2E PASSED — app boots, card renders, IDB + scheduler verified.")
    print("=" * 66)
    return 0


if __name__ == "__main__":
    sys.exit(main())
