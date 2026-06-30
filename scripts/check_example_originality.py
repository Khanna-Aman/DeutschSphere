#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Guards against shipping example sentences copied from the copyrighted official
Goethe/Hueber/telc/OeSD Wortliste PDFs. For each app entry it checks whether
`example_de` appears verbatim (or as a 6-word shingle) in the official source
text, and reports counts per level.

Source PDFs live in .raw_resources/ (git-ignored, not redistributed). If they
are absent (e.g. in CI), the script SKIPS with exit 0 — it is a local guard.

Exit codes:
  0  = OK (no verbatim copies, or sources unavailable to check)
  1  = verbatim/near copies detected (fails the check)

Usage:
  python scripts/check_example_originality.py            # all levels
  python scripts/check_example_originality.py --strict   # also fail on 6-gram near matches
"""
import os, re, sys, json, subprocess, argparse

try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, ".raw_resources")
PDFS = {
    "a1": "A1_SD1_Wortliste_02.pdf",
    "a2": "Goethe-Zertifikat_A2_Wortliste.pdf",
    "b1": "Goethe-Zertifikat_B1_Wortliste.pdf",
}

def have_pdftotext():
    from shutil import which
    return which("pdftotext") is not None

def pdftext(path):
    return subprocess.run(["pdftotext", "-enc", "UTF-8", path, "-"],
                          capture_output=True, text=True, encoding="utf-8").stdout

def normspace(s):
    return re.sub(r"\s+", " ", (s or "")).strip().lower()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="also fail on 6-gram near matches")
    args = ap.parse_args()

    missing = [p for p in PDFS.values() if not os.path.exists(os.path.join(RAW, p))]
    if missing or not have_pdftotext():
        print("[skip] official PDFs or pdftotext unavailable — originality check skipped.")
        return 0

    offtext = {lvl: normspace(pdftext(os.path.join(RAW, PDFS[lvl]))) for lvl in PDFS}
    offall = " ".join(offtext.values())

    total_exact = total_near = 0
    for lvl in ["a1", "a2", "b1"]:
        data = json.load(open(os.path.join(ROOT, lvl, "wordlist.json"), encoding="utf-8"))
        exact, near, n = [], [], 0
        for e in data:
            ex = normspace(e.get("example_de", ""))
            if not ex:
                continue
            n += 1
            if ex in offtext[lvl]:
                exact.append(e["id"])
            else:
                w = ex.split()
                if len(w) >= 6 and " ".join(w[:6]) in offall:
                    near.append(e["id"])
        total_exact += len(exact); total_near += len(near)
        flag = "OK" if not exact and (not near or not args.strict) else "FAIL"
        print(f"{lvl}: examples={n}  verbatim={len(exact)}  near6gram={len(near)}  -> {flag}")
        if exact[:10]:
            print(f"     verbatim ids (sample): {exact[:10]}")

    bad = total_exact + (total_near if args.strict else 0)
    print(f"\nTOTAL verbatim={total_exact}  near6gram={total_near}  ->", "FAIL" if bad else "PASS")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
