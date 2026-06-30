#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Second-opinion verification of the German example sentences with an LLM judge.

This complements check_grammar_languagetool.py (rule/ML engine, catches grammar
& spelling) by checking the things a grammar checker *cannot* see:
  * meaning match  — does the German actually mean the English translation?
  * level fit      — is it appropriate for the entry's CEFR level (A1/A2/B1)?
  * headword use   — does the sentence actually use/illustrate the target word?
  * naturalness    — would a native speaker write it this way?

It uses the Anthropic Batches API (50% cheaper, built for bulk non-latency work)
with structured outputs, so every verdict is a typed JSON object, not prose.

INDEPENDENCE CAVEAT — read this:
  The flashcard sentences are model-authored. Judging them with the *same* model
  family is a second opinion, not a fully independent audit: a same-model judge
  shares blind spots with the author. The genuinely independent automated layer
  is LanguageTool (a separate engine). For the strongest independent LLM signal,
  run this with --model pointed at a *different vendor's* model, or treat a clean
  pass here as corroboration of the LanguageTool result, not a substitute for a
  native-speaker spot-check.

Auth: standard Anthropic credential resolution. If ANTHROPIC_API_KEY is unset,
run `ant auth login` (the zero-arg client picks up the profile) — see
`ant auth status`. Requires: pip install anthropic

Exit codes:
  0  = OK (no flagged sentences, or run skipped because deps/creds absent)
  1  = sentences flagged by the judge (needs human review)

Usage:
  python scripts/check_examples_llm_judge.py --level a1
  python scripts/check_examples_llm_judge.py                 # all levels
  python scripts/check_examples_llm_judge.py --limit 50      # cheap smoke run
  python scripts/check_examples_llm_judge.py --report out.json
  python scripts/check_examples_llm_judge.py --model claude-opus-4-8
"""
import os, sys, json, time, argparse

try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVELS = ["a1", "a2", "b1"]
DEFAULT_MODEL = "claude-opus-4-8"

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "grammatical": {"type": "boolean", "description": "German is grammatically correct"},
        "meaning_match": {"type": "boolean", "description": "German means the same as the English"},
        "level_appropriate": {"type": "boolean", "description": "vocabulary/grammar fit the stated CEFR level"},
        "uses_headword": {"type": "boolean", "description": "sentence actually uses/illustrates the target word"},
        "natural": {"type": "boolean", "description": "a native speaker would write it this way"},
        "issue": {"type": "string", "description": "one short sentence; empty if all checks pass"},
    },
    "required": ["grammatical", "meaning_match", "level_appropriate", "uses_headword", "natural", "issue"],
    "additionalProperties": False,
}

SYSTEM = (
    "You are a meticulous German-as-a-foreign-language examiner for the Goethe "
    "A1-B1 levels. You judge a single example sentence. Be strict but fair: a "
    "sentence is acceptable if it is correct, idiomatic, matches its English "
    "translation, and is reasonable for the stated CEFR level. Minor stylistic "
    "preference is not a failure. Return only the structured verdict."
)


def load_examples(level):
    data = json.load(open(os.path.join(ROOT, level, "wordlist.json"), encoding="utf-8"))
    out = []
    for e in data:
        de = (e.get("example_de") or "").strip()
        if not de:
            continue
        out.append({
            "custom_id": f"{level}-{e.get('id')}",
            "level": level,
            "id": e.get("id"),
            "headword": (e.get("german") or e.get("base") or "").strip(),
            "english_word": (e.get("english") or "").strip(),
            "de": de,
            "en": (e.get("example_en") or "").strip(),
        })
    return out


def build_request(item, model, MakeParams):
    prompt = (
        f"Target word ({item['level'].upper()}): {item['headword']}"
        f"{' = ' + item['english_word'] if item['english_word'] else ''}\n"
        f"German sentence: {item['de']}\n"
        f"English translation given to the learner: {item['en']}\n\n"
        f"Judge the German sentence on the six criteria."
    )
    return MakeParams(
        custom_id=item["custom_id"],
        params={
            "model": model,
            "max_tokens": 1024,
            "system": SYSTEM,
            "thinking": {"type": "adaptive"},
            "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": VERDICT_SCHEMA}},
            "messages": [{"role": "user", "content": prompt}],
        },
    )


def parse_verdict(message):
    for block in message.content:
        if getattr(block, "type", None) == "text":
            try:
                return json.loads(block.text)
            except Exception:
                continue
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", choices=LEVELS, help="check a single level (default: all)")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"judge model (default: {DEFAULT_MODEL})")
    ap.add_argument("--limit", type=int, help="only judge the first N sentences (cheap smoke run)")
    ap.add_argument("--report", help="write a full JSON report to this path")
    ap.add_argument("--poll", type=int, default=60, help="seconds between batch status polls")
    args = ap.parse_args()

    try:
        import anthropic
        from anthropic.types.message_create_params import MessageCreateParamsNonStreaming  # noqa: F401
        from anthropic.types.messages.batch_create_params import Request as MakeRequest
    except Exception as e:
        print(f"[skip] anthropic SDK not available ({e!s}). Run: pip install anthropic")
        return 0

    try:
        client = anthropic.Anthropic()
    except Exception as e:
        print(f"[skip] could not init Anthropic client ({e!s}). "
              f"Set ANTHROPIC_API_KEY or run `ant auth login`.")
        return 0

    levels = [args.level] if args.level else LEVELS
    items = []
    for lvl in levels:
        items.extend(load_examples(lvl))
    if args.limit:
        items = items[: args.limit]
    if not items:
        print("[skip] no example sentences found.")
        return 0

    by_id = {it["custom_id"]: it for it in items}
    requests = [build_request(it, args.model, MakeRequest) for it in items]

    print(f"Submitting {len(requests)} sentences to the Batches API (model={args.model})...")
    batch = client.messages.batches.create(requests=requests)
    print(f"  batch id: {batch.id}  — polling every {args.poll}s (most batches finish < 1h)")

    while True:
        batch = client.messages.batches.retrieve(batch.id)
        if batch.processing_status == "ended":
            break
        c = batch.request_counts
        print(f"  status={batch.processing_status}  processing={c.processing} "
              f"succeeded={c.succeeded} errored={c.errored}")
        time.sleep(args.poll)

    flagged, errored, report = [], [], {lvl: [] for lvl in levels}
    checked = 0
    for result in client.messages.batches.results(batch.id):
        it = by_id.get(result.custom_id, {"custom_id": result.custom_id})
        if result.result.type != "succeeded":
            errored.append(result.custom_id)
            continue
        verdict = parse_verdict(result.result.message)
        if verdict is None:
            errored.append(result.custom_id)
            continue
        checked += 1
        ok = all(verdict.get(k) for k in
                 ("grammatical", "meaning_match", "level_appropriate", "uses_headword", "natural"))
        rec = {**{k: it.get(k) for k in ("level", "id", "headword", "de", "en")}, "verdict": verdict}
        report.setdefault(it.get("level", "?"), []).append(rec)
        if not ok:
            flagged.append(rec)

    # Per-level summary
    for lvl in levels:
        recs = report.get(lvl, [])
        bad = [r for r in recs if not all(r["verdict"].get(k) for k in
               ("grammatical", "meaning_match", "level_appropriate", "uses_headword", "natural"))]
        flag = "OK" if not bad else "FAIL"
        print(f"{lvl}: judged={len(recs):4d}  flagged={len(bad):4d}  -> {flag}")

    print(f"\nTOTAL judged={checked}  flagged={len(flagged)}  errored={len(errored)}")
    for r in flagged[:25]:
        v = r["verdict"]
        fails = [k for k in ("grammatical", "meaning_match", "level_appropriate", "uses_headword", "natural")
                 if not v.get(k)]
        print(f"    [{r['level']} #{r['id']}] fails={','.join(fails)}: {v.get('issue', '')}")
        print(f"        » {r['de']}  ({r['en']})")

    if args.report:
        json.dump(report, open(args.report, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"[report] {args.report}")

    print("VERDICT:", "FAIL" if flagged else "PASS")
    return 1 if flagged else 0


if __name__ == "__main__":
    sys.exit(main())
