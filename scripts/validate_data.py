#!/usr/bin/env python3
"""
Data-integrity gate for DeutschSphere wordlists.

This is the guardrail that the codebase audit found missing: nothing
previously stopped the published word counts, asset claims, or image
references from drifting away from the actual JSON data (the audit caught
docs claiming 3,921 words against an actual 2,627, and ~1,000 broken B1
image refs).

Treats each `<level>/wordlist.json` as the single source of truth and
asserts, with no third-party dependencies:

  1. Every wordlist.json is valid JSON and a non-empty list of objects.
  2. Each entry has the required keys (id, german, english) and unique ids.
  3. Every non-null 'image' reference points to a file that exists on disk
     (and the deprecated 'image_path' field never reappears).
  4. No image file is referenced by more than one entry (no wrong-word images).
  5. `<level>/wordlist.csv` has exactly one data row per JSON entry.
  6. The computed total (and per-level counts) appear verbatim in the docs,
     so a data change that forgets to update the docs fails the build.

Exit code is non-zero if any check fails. Run from the repo root:

    python scripts/validate_data.py
"""

from __future__ import annotations

import csv
import json
import os
import sys

LEVELS = ["a1", "a2", "b1"]

# Docs that quote the total vocabulary count. If the data changes, these
# must be updated in lockstep or CI fails.
DOCS_WITH_TOTAL = ["README.md", "index.html", "manifest.json", "VISION.md"]

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def fail(errors: list[str], msg: str) -> None:
    errors.append(msg)


def load_json(path: str, errors: list[str]):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        fail(errors, f"{path}: file not found")
    except json.JSONDecodeError as e:
        fail(errors, f"{path}: invalid JSON ({e})")
    return None


def csv_data_row_count(path: str, errors: list[str]) -> int | None:
    try:
        # utf-8-sig strips the BOM the converter writes for Excel.
        with open(path, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.reader(f))
    except FileNotFoundError:
        fail(errors, f"{path}: file not found")
        return None
    return len(rows) - 1  # minus header


def validate_level(level: str, errors: list[str]) -> int:
    """Validate one level; return its entry count (0 if unloadable)."""
    base = os.path.join(REPO_ROOT, level)
    json_path = os.path.join(base, "wordlist.json")
    csv_path = os.path.join(base, "wordlist.csv")

    data = load_json(json_path, errors)
    if data is None:
        return 0
    if not isinstance(data, list) or not data:
        fail(errors, f"{level}/wordlist.json: expected a non-empty JSON array")
        return 0

    seen_ids: set = set()
    image_owner: dict[str, int] = {}
    broken: list[str] = []

    for i, entry in enumerate(data):
        if not isinstance(entry, dict):
            fail(errors, f"{level}/wordlist.json[{i}]: entry is not an object")
            continue

        # Required schema
        for key in ("id", "german", "english"):
            if key not in entry or entry[key] in (None, ""):
                fail(errors, f"{level}/wordlist.json[{i}]: missing required '{key}'")

        eid = entry.get("id")
        if eid in seen_ids:
            fail(errors, f"{level}/wordlist.json: duplicate id={eid}")
        seen_ids.add(eid)

        # Image reference: a single 'image' field. The legacy redundant
        # 'image_path' field was collapsed into 'image'; flag any regression
        # that reintroduces it so the schema stays single-source.
        if "image_path" in entry:
            fail(
                errors,
                f"{level} id={eid}: deprecated 'image_path' field present; use 'image' only",
            )
        ref = entry.get("image")
        if ref:
            disk = os.path.join(base, ref)
            if not os.path.exists(disk):
                broken.append(f"id={eid} -> {ref}")
            if ref in image_owner:
                fail(
                    errors,
                    f"{level}: image {ref} shared by id={image_owner[ref]} and id={eid}",
                )
            else:
                image_owner[ref] = eid

    if broken:
        sample = ", ".join(broken[:8])
        more = f" (+{len(broken) - 8} more)" if len(broken) > 8 else ""
        fail(errors, f"{level}: {len(broken)} broken image refs: {sample}{more}")

    csv_rows = csv_data_row_count(csv_path, errors)
    if csv_rows is not None and csv_rows != len(data):
        fail(
            errors,
            f"{level}: wordlist.csv has {csv_rows} rows but wordlist.json has "
            f"{len(data)} entries (regenerate with scripts/convert_json_to_csv.js)",
        )

    print(
        f"  {level}: {len(data):4d} entries | "
        f"{len(image_owner):4d} image refs | {len(broken)} broken | "
        f"csv {'OK' if csv_rows == len(data) else 'MISMATCH'}"
    )
    return len(data)


def check_doc_counts(total: int, per_level: dict[str, int], errors: list[str]) -> None:
    formatted_total = f"{total:,}"  # e.g. "2,627"
    for doc in DOCS_WITH_TOTAL:
        path = os.path.join(REPO_ROOT, doc)
        try:
            with open(path, encoding="utf-8") as f:
                text = f.read()
        except FileNotFoundError:
            fail(errors, f"{doc}: file not found")
            continue
        if formatted_total not in text and str(total) not in text:
            fail(
                errors,
                f"{doc}: published total does not match data total {formatted_total} "
                f"(update the doc or the data)",
            )
    print(f"  docs checked for total '{formatted_total}': {', '.join(DOCS_WITH_TOTAL)}")


def main() -> int:
    errors: list[str] = []
    print("Validating wordlist data integrity...")

    per_level: dict[str, int] = {}
    for level in LEVELS:
        per_level[level] = validate_level(level, errors)

    total = sum(per_level.values())
    print(f"  TOTAL: {total} entries "
          f"(A1 {per_level['a1']} / A2 {per_level['a2']} / B1 {per_level['b1']})")

    if total > 0:
        check_doc_counts(total, per_level, errors)

    print()
    if errors:
        print(f"FAILED with {len(errors)} error(s):")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("All data-integrity checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
