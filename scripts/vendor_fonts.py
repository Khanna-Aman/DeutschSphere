#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Self-host web fonts to eliminate runtime calls to Google Fonts and Cloudflare
(privacy/GDPR + genuine offline). Downloads Inter/Outfit (Google Fonts) and
FontAwesome 6.4.0 Free into ./fonts and rewrites the CSS to local paths.

Idempotent: re-running re-downloads and overwrites. Run once; commit ./fonts.
"""
import os, re, sys, urllib.request

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

ROOT = r"d:\Aman\_________Projects\A1-B1_German"
FONTS = os.path.join(ROOT, "fonts")
FILES = os.path.join(FONTS, "files")
WEBFONTS = os.path.join(FONTS, "webfonts")
for d in (FONTS, FILES, WEBFONTS): os.makedirs(d, exist_ok=True)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read() if binary else r.read().decode("utf-8")

# ---------- Google Fonts (Inter + Outfit) ----------
GF = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap"
css = fetch(GF)
# split into @font-face blocks; keep only latin + latin-ext subsets
blocks = re.findall(r"/\*[^*]*\*/\s*@font-face\s*\{[^}]*\}", css)
keep, n = [], 0
for b in blocks:
    label = re.match(r"/\*\s*([\w-]+)", b)
    sub = label.group(1) if label else ""
    if sub not in ("latin", "latin-ext"):
        continue
    m = re.search(r"url\((https://[^)]+\.woff2)\)", b)
    if not m: continue
    url = m.group(1)
    fam = re.search(r"font-family:\s*'([^']+)'", b).group(1).lower()
    wght = re.search(r"font-weight:\s*(\d+)", b).group(1)
    fname = f"{fam}-{wght}-{sub}.woff2"
    open(os.path.join(FILES, fname), "wb").write(fetch(url, binary=True))
    keep.append(b.replace(url, f"./files/{fname}"))
    n += 1
open(os.path.join(FONTS, "google-fonts.css"), "w", encoding="utf-8").write("\n".join(keep) + "\n")
print(f"[google] wrote {n} woff2 + google-fonts.css")

# ---------- FontAwesome 6.4.0 Free ----------
FA_CSS = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
fa = fetch(FA_CSS)
faces = set(re.findall(r"(fa-[\w-]+\.woff2)", fa))
for f in faces:
    url = f"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/{f}"
    try:
        open(os.path.join(WEBFONTS, f), "wb").write(fetch(url, binary=True))
    except Exception as e:
        print("  skip", f, e)
# rewrite ../webfonts/ (relative to fonts/) and strip any remaining absolute cdn refs
fa = re.sub(r"url\(\.\./webfonts/", "url(./webfonts/", fa)
fa = re.sub(r"url\((?:https?:)?//[^)]*?/webfonts/", "url(./webfonts/", fa)
# drop .ttf fallbacks (woff2 is universally supported; avoids shipping unused files)
fa = re.sub(r",\s*url\(\./webfonts/[^)]+\.ttf\)\s*format\(([\"'])truetype\1\)", "", fa)
for f in list(faces):
    if f.endswith(".ttf"):
        try: os.remove(os.path.join(WEBFONTS, f))
        except OSError: pass
open(os.path.join(FONTS, "fontawesome.min.css"), "w", encoding="utf-8").write(fa)
print(f"[fontawesome] wrote {len(faces)} woff2 + fontawesome.min.css")
print("DONE. Sizes:")
tot = 0
for base in (FILES, WEBFONTS):
    for fn in os.listdir(base):
        sz = os.path.getsize(os.path.join(base, fn)); tot += sz
print(f"  total font payload: {tot/1024:.0f} KB across files/+webfonts/")
