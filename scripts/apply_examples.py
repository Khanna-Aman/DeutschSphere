#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Apply a patch of ORIGINAL example sentences to a level's wordlist.json.

Patch file = JSON array of {"id": int, "de": "...", "en": "..."}.
Only example_de / example_en are touched; every other field is preserved.
A timestamped backup is written under scripts/backups/ first.

Usage:
  python scripts/apply_examples.py --level a1 --patch path/to/patch.json
"""
import os, sys, json, time, shutil, argparse

try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", required=True, choices=["a1", "a2", "b1"])
    ap.add_argument("--patch", required=True)
    args = ap.parse_args()

    wl_path = os.path.join(ROOT, args.level, "wordlist.json")
    data = json.load(open(wl_path, encoding="utf-8"))
    patch = json.load(open(args.patch, encoding="utf-8"))
    by_id = {e["id"]: e for e in data}

    backup_dir = os.path.join(ROOT, "scripts", "backups")
    os.makedirs(backup_dir, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    shutil.copy2(wl_path, os.path.join(backup_dir, f"{args.level}_wordlist_backup_{ts}.json"))

    applied, missing = 0, []
    for p in patch:
        e = by_id.get(p["id"])
        if not e:
            missing.append(p["id"]); continue
        de, en = p.get("de", "").strip(), p.get("en", "").strip()
        if de: e["example_de"] = de
        if en: e["example_en"] = en
        applied += 1

    json.dump(data, open(wl_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"[{args.level}] applied {applied} / {len(patch)} (missing ids: {missing[:10]})")

if __name__ == "__main__":
    sys.exit(main())
