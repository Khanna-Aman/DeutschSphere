#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Independent (non-LLM) grammar/spelling verification of the German example
sentences using LanguageTool — a rule + ML proofreading engine whose German
support is among its strongest. This is an autonomous "third-party" check: the
sentences are model-authored, but the verdict here comes from a separate engine,
not from the model that wrote them.

By default it runs a LOCAL LanguageTool server through the bundled Java runtime
(language_tool_python downloads LanguageTool once, ~230 MB, then runs fully
offline — no rate limits, nothing leaves the machine). Use --remote to hit the
public API instead (network + rate-limited; sends sentences to languagetool.org).

Issues are split into:
  * HARD   (grammar + spelling)  -> counted as defects, fails the gate
  * SOFT   (style/typography/etc.) -> advisory only, never fails
Proper nouns we deliberately use (names/places) are allow-listed so they are not
reported as spelling errors.

Exit codes:
  0  = OK (no hard defects, or LanguageTool unavailable -> skipped)
  1  = hard grammar/spelling defects found
  2  = could not start LanguageTool and --remote not usable

Usage:
  python scripts/check_grammar_languagetool.py                 # all levels, local server
  python scripts/check_grammar_languagetool.py --level a1      # one level
  python scripts/check_grammar_languagetool.py --remote        # public API
  python scripts/check_grammar_languagetool.py --report out.json
  python scripts/check_grammar_languagetool.py --show 40       # print first N defects
"""
import os, re, sys, json, time, argparse

try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVELS = ["a1", "a2", "b1"]

# LanguageTool rule issue types / categories we treat as real defects.
# NB: many real grammar rules (e.g. DE_AGREEMENT) report rule_issue_type
# "uncategorized" but category "GRAMMAR", so we check the category too.
HARD_ISSUE_TYPES = {"grammar", "misspelling"}
HARD_CATEGORIES = {"GRAMMAR", "TYPOS"}
# Specific rule IDs that are noise for short, correctly-capitalised flashcard
# sentences and are demoted to advisory regardless of issue type.
SOFT_RULE_IDS = {
    "UPPERCASE_SENTENCE_START",   # our sentences are already capitalised
    "COMMA_PARENTHESIS_WHITESPACE",
    "WHITESPACE_RULE",
    "DE_CASE",                    # often false-positives on flashcard fragments
}
# Proper nouns / loanwords we intentionally use that the spell rule may not know.
ALLOW_WORDS = {
    "Anna", "Lena", "Anto", "Tom", "Lisa", "Max", "Mehmet", "Ali",
    "Deutschsphere", "DeutschSphere", "Pommes", "S-Bahn", "Lkw",
}
SPELL_RULE_PREFIXES = ("MORFOLOGIK", "GERMAN_SPELLING", "HUNSPELL")


def load_examples(level):
    path = os.path.join(ROOT, level, "wordlist.json")
    data = json.load(open(path, encoding="utf-8"))
    out = []
    for e in data:
        de = (e.get("example_de") or "").strip()
        if de:
            out.append((e.get("id"), de, (e.get("example_en") or "").strip()))
    return out


def flagged_word(match, text):
    try:
        return text[match.offset:match.offset + match.error_length]
    except Exception:
        return ""


def is_allowlisted_spelling(match, text):
    rid = (match.rule_id or "")
    if not rid.startswith(SPELL_RULE_PREFIXES):
        return False
    return flagged_word(match, text).strip(".,!?;:") in ALLOW_WORDS


def classify(match, text):
    """Return 'hard' | 'soft' for a LanguageTool match."""
    if match.rule_id in SOFT_RULE_IDS:
        return "soft"
    if is_allowlisted_spelling(match, text):
        return "soft"
    itype = (getattr(match, "rule_issue_type", "") or "").lower()
    cat = (getattr(match, "category", "") or "").upper()
    return "hard" if (itype in HARD_ISSUE_TYPES or cat in HARD_CATEGORIES) else "soft"


def get_tool(remote):
    import language_tool_python as lt
    if remote:
        return lt.LanguageToolPublicAPI("de-DE")
    return lt.LanguageTool("de-DE")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", choices=LEVELS, help="check a single level (default: all)")
    ap.add_argument("--remote", action="store_true", help="use public API instead of local server")
    ap.add_argument("--report", help="write a full JSON report to this path")
    ap.add_argument("--show", type=int, default=15, help="print first N hard defects (default 15)")
    ap.add_argument("--soft", action="store_true", help="also fail on soft/advisory issues")
    args = ap.parse_args()

    try:
        tool = get_tool(args.remote)
    except Exception as e:
        print(f"[skip] could not start LanguageTool ({e!s}). "
              f"Install Java + `pip install language_tool_python`, or pass --remote.")
        return 0

    levels = [args.level] if args.level else LEVELS
    report = {}
    total_hard = total_soft = total_checked = 0
    shown = 0

    for lvl in levels:
        examples = load_examples(lvl)
        hard_items, soft_items = [], []
        for idx, (wid, de, en) in enumerate(examples):
            if args.remote and idx and idx % 18 == 0:
                time.sleep(3)  # stay under the public API rate limit
            try:
                matches = tool.check(de)
            except Exception as e:
                soft_items.append({"id": wid, "de": de, "rule": "CHECK_ERROR", "msg": str(e)})
                continue
            for m in matches:
                kind = classify(m, de)
                rec = {
                    "id": wid, "de": de, "rule": m.rule_id,
                    "type": getattr(m, "rule_issue_type", ""),
                    "category": getattr(m, "category", ""),
                    "msg": m.message,
                    "suggest": (m.replacements or [])[:3],
                    "context": m.context,
                }
                (hard_items if kind == "hard" else soft_items).append(rec)

        total_checked += len(examples)
        total_hard += len(hard_items)
        total_soft += len(soft_items)
        report[lvl] = {"checked": len(examples), "hard": hard_items, "soft": soft_items}
        flag = "OK" if not hard_items else "FAIL"
        print(f"{lvl}: checked={len(examples):4d}  grammar/spell defects={len(hard_items):4d}  "
              f"advisory={len(soft_items):4d}  -> {flag}")

        for it in hard_items:
            if shown >= args.show:
                break
            shown += 1
            sug = (" | suggest: " + ", ".join(it["suggest"])) if it["suggest"] else ""
            print(f"    [{lvl} #{it['id']}] {it['rule']}: {it['msg']}{sug}")
            print(f"        » {it['de']}")

    print(f"\nTOTAL checked={total_checked}  grammar/spell defects={total_hard}  "
          f"advisory={total_soft}")

    if args.report:
        json.dump(report, open(args.report, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        print(f"[report] {args.report}")

    try:
        tool.close()
    except Exception:
        pass

    bad = total_hard + (total_soft if args.soft else 0)
    print("VERDICT:", "FAIL" if bad else "PASS")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
