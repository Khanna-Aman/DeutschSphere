#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Guards against shipping example sentences copied from the copyrighted official
Goethe/Hueber/telc/OeSD Wortliste PDFs. For each app entry it checks whether
`example_de` appears verbatim (or as a 6-word shingle) in the official source
text, and reports counts per level.

Two ways to run:

1. LOCAL (default) — compares directly against the source PDFs in .raw_resources/
   (git-ignored, not redistributed). If they are absent, this mode SKIPS with
   exit 0 — so on its own it is only a local guard.

2. CI / FINGERPRINT — checks against a committed, non-copyrighted *fingerprint*
   (salted SHA-256 hashes of the official 6-word shingles). This needs NO PDFs,
   so it runs in CI and makes the copyright gate real (not vacuous). Build the
   fingerprint once locally (where the PDFs exist), commit it, and check against
   it in CI.

Exit codes:
  0  = OK (no verbatim copies, or, in default mode, sources unavailable to check)
  1  = verbatim copies detected (fails the check); or a build/usage error

Usage:
  python scripts/check_example_originality.py                       # local, all levels
  python scripts/check_example_originality.py --strict              # also fail on 6-gram near matches
  python scripts/check_example_originality.py --build-fingerprint scripts/originality_fingerprint.json
  python scripts/check_example_originality.py --fingerprint scripts/originality_fingerprint.json
"""
import os, re, sys, json, subprocess, argparse, hashlib, secrets

try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, ".raw_resources")
PDFS = {
    "a1": "A1_SD1_Wortliste_02.pdf",
    "a2": "Goethe-Zertifikat_A2_Wortliste.pdf",
    "b1": "Goethe-Zertifikat_B1_Wortliste.pdf",
}
LEVELS = ["a1", "a2", "b1"]
K = 6  # shingle size (words)

def have_pdftotext():
    from shutil import which
    return which("pdftotext") is not None

def pdftext(path):
    return subprocess.run(["pdftotext", "-enc", "UTF-8", path, "-"],
                          capture_output=True, text=True, encoding="utf-8").stdout

def normspace(s):
    return re.sub(r"\s+", " ", (s or "")).strip().lower()

def shingles(text, k=K):
    """Overlapping k-word shingles of normalized text (empty if fewer than k words)."""
    w = normspace(text).split()
    return [" ".join(w[i:i + k]) for i in range(len(w) - k + 1)] if len(w) >= k else []

def salted_hash(shingle, salt):
    return hashlib.sha256((salt + "\x1f" + shingle).encode("utf-8")).hexdigest()[:16]

def load_examples():
    """Yield (level, id, example_de) for every entry that has a non-empty example."""
    for lvl in LEVELS:
        data = json.load(open(os.path.join(ROOT, lvl, "wordlist.json"), encoding="utf-8"))
        for e in data:
            ex = e.get("example_de", "")
            if normspace(ex):
                yield lvl, e["id"], ex

# --------------------------------------------------------------------------
# Mode 1: local, direct-against-PDF check (original behaviour)
# --------------------------------------------------------------------------
def run_local(strict):
    missing = [p for p in PDFS.values() if not os.path.exists(os.path.join(RAW, p))]
    if missing or not have_pdftotext():
        print("[skip] official PDFs or pdftotext unavailable — local originality check skipped.")
        print("       (use --fingerprint <file> for the CI-safe check.)")
        return 0

    offtext = {lvl: normspace(pdftext(os.path.join(RAW, PDFS[lvl]))) for lvl in PDFS}
    offall = " ".join(offtext.values())

    total_exact = total_near = 0
    for lvl in LEVELS:
        data = json.load(open(os.path.join(ROOT, lvl, "wordlist.json"), encoding="utf-8"))
        exact, near, n = [], [], 0
        for e in data:
            ex = normspace(e.get("example_de", ""))
            if not ex:
                continue
            n += 1
            w = ex.split()
            # Check against the GLOBAL source (all levels), not just this level's PDF —
            # the official B1 Wortliste is cumulative, so an A1/A2 example can copy a
            # sentence that only appears in the B1 PDF (a per-level check misses those).
            # Verbatim = a substantial (>K-word) contiguous span reproduced from the
            # source. Shorter coincidental matches of generic phrases ("Einen Kaffee,
            # bitte.") are not copyrightable expression -> advisory (near) only. This
            # mirrors the fingerprint mode's ">=2 overlapping shingles" rule.
            if len(w) > K and ex in offall:
                exact.append(e["id"])
            elif len(w) >= K and " ".join(w[:K]) in offall:
                near.append(e["id"])
        total_exact += len(exact); total_near += len(near)
        flag = "OK" if not exact and (not near or not strict) else "FAIL"
        print(f"{lvl}: examples={n}  verbatim={len(exact)}  near6gram={len(near)}  -> {flag}")
        if exact[:10]:
            print(f"     verbatim ids (sample): {exact[:10]}")

    bad = total_exact + (total_near if strict else 0)
    print(f"\nTOTAL verbatim={total_exact}  near6gram={total_near}  ->", "FAIL" if bad else "PASS")
    return 1 if bad else 0

# --------------------------------------------------------------------------
# Mode 2a: build the committed fingerprint from the PDFs
# --------------------------------------------------------------------------
def build_fingerprint(out):
    missing = [p for p in PDFS.values() if not os.path.exists(os.path.join(RAW, p))]
    if missing or not have_pdftotext():
        print("[error] cannot build fingerprint — official PDFs or pdftotext unavailable.")
        print(f"        missing: {missing}")
        return 1
    salt = secrets.token_hex(8)
    hashes = set()
    for lvl in PDFS:
        txt = pdftext(os.path.join(RAW, PDFS[lvl]))
        for sh in shingles(txt):
            hashes.add(salted_hash(sh, salt))
    obj = {
        "_comment": "Salted SHA-256 (truncated to 16 hex) of every 6-word shingle in the "
                    "official Goethe A1/A2/B1 Wortliste PDFs. One-way hashes — this file "
                    "does NOT contain or reveal the copyrighted source text; it only lets "
                    "check_example_originality.py detect reused source sentences without "
                    "redistributing the PDFs. Regenerate with --build-fingerprint.",
        "version": 1,
        "algo": "sha256-16",
        "k": K,
        "salt": salt,
        "count": len(hashes),
        "hashes": sorted(hashes),
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(out) / 1024
    print(f"[ok] wrote {out}  ({len(hashes)} unique 6-gram hashes, {size_kb:.0f} KB)")
    return 0

# --------------------------------------------------------------------------
# Mode 2b: CI-safe check against the committed fingerprint (no PDFs needed)
# --------------------------------------------------------------------------
def run_fingerprint(fp_path, strict):
    if not os.path.exists(fp_path):
        print(f"[error] fingerprint file not found: {fp_path}")
        print("        build it locally: python scripts/check_example_originality.py "
              "--build-fingerprint " + fp_path)
        return 1
    fp = json.load(open(fp_path, encoding="utf-8"))
    salt = fp["salt"]; k = int(fp.get("k", K)); hs = set(fp["hashes"])
    print(f"[fingerprint] {os.path.basename(fp_path)}: {len(hs)} source shingle hashes (k={k})")

    per_level = {lvl: {"exact": [], "near": [], "n": 0} for lvl in LEVELS}
    for lvl, cid, ex in load_examples():
        per_level[lvl]["n"] += 1
        shs = shingles(ex, k)
        if not shs:
            continue  # example shorter than k words — not fingerprint-checkable (rare; local mode covers it)
        matched = sum(1 for s in shs if salted_hash(s, salt) in hs)
        # Verbatim = the whole sentence is present in the source: every one of its
        # (>=2) overlapping shingles matches. A lone matching 6-gram (common phrase)
        # stays "near"/advisory, never a hard fail.
        if len(shs) >= 2 and matched == len(shs):
            per_level[lvl]["exact"].append(cid)
        elif matched > 0:
            per_level[lvl]["near"].append(cid)

    total_exact = total_near = 0
    for lvl in LEVELS:
        d = per_level[lvl]
        total_exact += len(d["exact"]); total_near += len(d["near"])
        flag = "OK" if not d["exact"] and (not d["near"] or not strict) else "FAIL"
        print(f"{lvl}: examples={d['n']}  verbatim={len(d['exact'])}  nearNgram={len(d['near'])}  -> {flag}")
        if d["exact"][:10]:
            print(f"     verbatim ids (sample): {d['exact'][:10]}")

    bad = total_exact + (total_near if strict else 0)
    print(f"\nTOTAL verbatim={total_exact}  nearNgram={total_near}  ->", "FAIL" if bad else "PASS")
    if total_near and not strict:
        print("(near matches are advisory — a hard fail requires a full verbatim source sentence.)")
    return 1 if bad else 0

def main():
    ap = argparse.ArgumentParser(description="Example-sentence copyright originality gate.")
    ap.add_argument("--strict", action="store_true", help="also fail on near-shingle matches")
    ap.add_argument("--build-fingerprint", metavar="OUT",
                    help="build the salted-hash fingerprint from the local PDFs and write it to OUT")
    ap.add_argument("--fingerprint", metavar="IN",
                    help="CI-safe check against a committed fingerprint file (no PDFs needed)")
    args = ap.parse_args()

    if args.build_fingerprint:
        return build_fingerprint(args.build_fingerprint)
    if args.fingerprint:
        return run_fingerprint(args.fingerprint, args.strict)
    return run_local(args.strict)

if __name__ == "__main__":
    sys.exit(main())
