#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Self-host web fonts to eliminate runtime calls to Google Fonts and Cloudflare
(privacy/GDPR + genuine offline). Downloads Inter/Outfit VARIABLE fonts (Google
Fonts) and Font Awesome 6.4.0 Free's solid/brands webfonts (Cloudflare cdnjs)
into ./fonts, then subsets both down to what this app actually uses:

  - Inter/Outfit: only the `latin` Unicode-range subset (German umlauts/ß and
    all UI text fall inside U+0000-00FF/U+2000-206F; this app has no content
    in `latin-ext`, which is Central-European/Vietnamese/Baltic coverage).
    One variable-weight (fvar wght 100-900) woff2 per family replaces what
    used to be 5 static weight files x 2 subsets = 10 files/family.
  - Font Awesome: only `fa-solid-900.woff2` + `fa-brands-400.woff2` are
    fetched as FULL-GLYPH SOURCE fonts (regular/v4compatibility are unused
    in this codebase — no `.fa-regular`/`far`/v4-style `fa fa-*` classes —
    and are skipped entirely). The actually-served files are glyph-subset
    to only the icons referenced in index.html/js/*.js by
    scripts/subset_fontawesome.py, invoked automatically at the end.

Idempotent: re-running re-downloads the source fonts and re-subsets from
current usage. Run after bumping font versions; commit ./fonts.
"""
import os, re, subprocess, sys, urllib.request

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "fonts")
FILES = os.path.join(FONTS, "files")
WEBFONTS = os.path.join(FONTS, "webfonts")
for d in (FONTS, FILES, WEBFONTS): os.makedirs(d, exist_ok=True)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read() if binary else r.read().decode("utf-8")

# ---------- Google Fonts: Inter + Outfit, VARIABLE, latin-only ----------
GF = "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Outfit:wght@100..900&display=swap"
css = fetch(GF)
blocks = re.findall(r"/\*[^*]*\*/\s*@font-face\s*\{[^}]*\}", css)
written = []
for b in blocks:
    label = re.match(r"/\*\s*([\w-]+)", b)
    sub = label.group(1) if label else ""
    if sub != "latin":  # latin-ext intentionally dropped — see docstring
        continue
    url = re.search(r"url\((https://[^)]+\.woff2)\)", b).group(1)
    fam = re.search(r"font-family:\s*'([^']+)'", b).group(1).lower()
    fname = f"{fam}-variable-latin.woff2"
    open(os.path.join(FILES, fname), "wb").write(fetch(url, binary=True))
    b = re.sub(r"font-weight:\s*\d+;", "font-weight: 100 900;", b)
    b = b.replace(url, f"./files/{fname}")
    written.append(b)
    print(f"[google] {fam}: wrote {fname}")
open(os.path.join(FONTS, "google-fonts.css"), "w", encoding="utf-8").write("\n".join(written) + "\n")

# ---------- Font Awesome 6.4.0 Free: solid + brands source fonts only ----------
FA_CSS = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
fa = fetch(FA_CSS)
KEEP_FACES = {"fa-solid-900.woff2", "fa-brands-400.woff2"}
for f in KEEP_FACES:
    url = f"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/{f}"
    open(os.path.join(WEBFONTS, f), "wb").write(fetch(url, binary=True))
    print(f"[fontawesome] wrote {f} (full-glyph source)")

# Normalize every url(...?/webfonts/NAME) — relative (../webfonts/, ./webfonts/)
# or absolute (cdnjs) — to a single ./webfonts/NAME form first, so the later
# brands/solid renames can't double-match an overlapping "./webfonts/" tail
# inside a "../webfonts/" path (that overlap previously produced broken
# "../webfonts/NAME.subset.woff2" paths).
fa = re.sub(r"url\((?:https?:)?(?://[^)]*?)?(?:\.\./|\./)?webfonts/([^)]+)\)", r"url(./webfonts/\1)", fa)
# Point the two live @font-face rules at the subset files subset_fontawesome.py
# will generate, and drop every rule referencing regular-400/v4compatibility
# (unused fonts, not downloaded) plus the legacy FA5/"FontAwesome" v4 family
# aliases (unused — this codebase only uses fa-solid/fa-brands classes).
fa = fa.replace("./webfonts/fa-brands-400.woff2", "./webfonts/fa-brands-400.subset.woff2")
fa = fa.replace("./webfonts/fa-solid-900.woff2", "./webfonts/fa-solid-900.subset.woff2")
fa = re.sub(r'@font-face\{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:400;[^}]*\}', "", fa)
fa = re.sub(r'@font-face\{font-family:"Font Awesome 5[^"]*"[^}]*\}', "", fa)
fa = re.sub(r'@font-face\{font-family:"FontAwesome"[^}]*\}', "", fa)
# drop any remaining .ttf fallback declarations (woff2 is universally supported)
fa = re.sub(r",\s*url\([^)]+\.ttf\)\s*format\(([\"'])truetype\1\)", "", fa)
open(os.path.join(FONTS, "fontawesome.min.css"), "w", encoding="utf-8").write(fa)
print("[fontawesome] wrote fontawesome.min.css (patched to reference .subset.woff2, legacy blocks dropped)")

# ---------- Subset FA to actually-used glyphs ----------
subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "subset_fontawesome.py")], check=True)

print("DONE. Served font payload:")
served = [
    os.path.join(FILES, "inter-variable-latin.woff2"),
    os.path.join(FILES, "outfit-variable-latin.woff2"),
    os.path.join(WEBFONTS, "fa-solid-900.subset.woff2"),
    os.path.join(WEBFONTS, "fa-brands-400.subset.woff2"),
]
tot = sum(os.path.getsize(p) for p in served if os.path.exists(p))
print(f"  {tot/1024:.1f} KB across {len(served)} files (full-glyph FA source fonts not counted — never served)")
