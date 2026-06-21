#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Quick test of compact audit prompt against NotebookLM."""
import sys, json

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

from notebooklm_tools.core.client import NotebookLMClient
from notebooklm_tools.core.auth import load_cached_tokens

NOTEBOOK_ID = "efa902d2-f8e4-480e-94da-554cdb87e674"

tokens = load_cached_tokens()
client = NotebookLMClient(
    cookies=tokens.cookies,
    csrf_token=tokens.csrf_token,
    session_id=tokens.session_id,
    build_label=tokens.build_label,
)

words = json.load(open("a1/wordlist.json", encoding="utf-8"))
batch = words[0:5]

# Compact format - only key fields
entries = []
for w in batch:
    e = {
        "german": w.get("german"),
        "english": w.get("english"),
        "gender": w.get("gender"),
        "plural": w.get("plural"),
        "theme": w.get("theme"),
    }
    if w.get("word_class") == "Verb" and w.get("verb_conjugation"):
        e["verb_conjugation"] = w["verb_conjugation"]
    entries.append(e)

input_json = json.dumps(entries, ensure_ascii=False)

prompt = (
    "Verify these 5 A1 German vocabulary entries against the official Goethe-Institut wordlist in your notebook. "
    "Check: english translation, gender, plural (must be absolute with 'die' prefix), theme category, and verb conjugations if present. "
    'Return a JSON array with exactly 5 objects: [{"german":"...","has_corrections":true/false,"corrections":{}}]. '
    "Only include fields needing changes in corrections. Return ONLY the JSON array.\n\n"
    f"Words:\n{input_json}"
)

print(f"Prompt length: {len(prompt)} chars")
print("Querying NotebookLM...")

result = client.query(NOTEBOOK_ID, prompt)
print("\n=== RESULT ===")
print(json.dumps(result, indent=2, ensure_ascii=False))
