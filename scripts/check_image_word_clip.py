#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Semantic image<->word verification for the DeutschSphere WebP card art.

validate_data.py already proves the STRUCTURAL mapping (every `image` ref
exists, none shared by two entries). This script checks the SEMANTIC mapping:
does card_N.webp actually DEPICT the word it is mapped to?

It is a dev-time, offline-capable verification tool (no paid API, no runtime
client dependency). Two free, local layers:

  Layer 1 - duplicate sweep (perceptual hash, `imagehash`):
      flags different cards whose images are near-identical (a generation
      artifact, e.g. a generic fallback reused for many words).

  Layer 2 - CLIP retrieval (open-source `clip-vit-base-patch32`):
      for each image, rank its OWN word's English gloss against ALL the
      level's glosses. If the correct word ranks #1 -> confident match. If it
      ranks poorly while a different word dominates -> likely mismatch (flag).
      If similarities are weak everywhere -> inconclusive (abstract word that
      can't really be drawn; we do NOT false-flag these).

Outputs:
  - a JSON report (every image: self-rank, top competitor, verdict bucket);
  - a self-contained HTML review sheet showing only the cards that need human
    eyes (mismatch + inconclusive), worst-first, with thumbnails.

CLIP is reliable on concrete nouns and weak on abstractions, so this is a
high-precision FLAG-FOR-REVIEW tool, not an oracle. Final call is human.

Run with the dedicated D: venv that has torch+transformers+imagehash:
  D:\\deutschsphere-imgverify\\venv\\Scripts\\python.exe scripts/check_image_word_clip.py
Usage:
  ... check_image_word_clip.py --level a1
  ... check_image_word_clip.py                 # all levels
  ... check_image_word_clip.py --limit 50      # quick smoke run
  ... check_image_word_clip.py --report out.json --html review.html
"""
import os
# Keep the model cache on D: (created by the setup step); harmless if absent.
os.environ.setdefault("HF_HOME", r"D:\deutschsphere-imgverify\hf_cache")

import re
import sys
import json
import html
import base64
import argparse
from io import BytesIO

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVELS = ["a1", "a2", "b1"]
CLIP_MODEL = "openai/clip-vit-base-patch32"
# CLIP zero-shot prompt templates (ensembled for a more stable text vector).
TEMPLATES = ["{}", "a photo of {}", "an illustration of {}", "a drawing of {}", "an icon of {}"]
PHASH_NEAR = 5  # Hamming distance <= this => near-duplicate images


def clean_gloss(english: str) -> str:
    """Turn an English gloss into a short, CLIP-friendly noun phrase."""
    g = (english or "").strip()
    g = re.sub(r"\([^)]*\)", "", g)          # drop parentheticals
    g = g.split("/")[0].strip()              # first sense only
    g = re.sub(r"^to\s+", "", g)             # 'to lock' -> 'lock'
    g = re.sub(r"^(the|a|an)\s+", "", g, flags=re.I)
    return g or (english or "").strip()


def load_entries(level):
    data = json.load(open(os.path.join(ROOT, level, "wordlist.json"), encoding="utf-8"))
    out = []
    for e in data:
        img = e.get("image")
        if not img:
            continue
        disk = os.path.join(ROOT, level, img)
        if not os.path.exists(disk):
            continue
        out.append({
            "level": level, "id": e.get("id"),
            "german": (e.get("german") or "").strip(),
            "english": (e.get("english") or "").strip(),
            "gloss": clean_gloss(e.get("english") or ""),
            "image": img, "path": disk,
        })
    return out


# ---------- Layer 1: perceptual-hash duplicate sweep ----------
def duplicate_sweep(entries, Image, imagehash):
    hashes = {}
    for it in entries:
        try:
            with Image.open(it["path"]) as im:
                hashes[it["id"]] = imagehash.phash(im.convert("RGB"))
        except Exception:
            hashes[it["id"]] = None
    dupes = []
    ids = [it["id"] for it in entries if hashes.get(it["id"]) is not None]
    by_id = {it["id"]: it for it in entries}
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = ids[i], ids[j]
            d = hashes[a] - hashes[b]
            if d <= PHASH_NEAR:
                dupes.append({
                    "a_id": a, "a_word": by_id[a]["german"], "a_image": by_id[a]["image"],
                    "b_id": b, "b_word": by_id[b]["german"], "b_image": by_id[b]["image"],
                    "distance": int(d),
                })
    return dupes


# ---------- Layer 2: CLIP retrieval ----------
def clip_verify(entries, torch, model, processor):
    import torch as T

    def embed_text(prompts):
        # transformers 5.x: get_text_features returns an output object, so use
        # the explicit, stable CLIP path (text tower -> text projection).
        toks = processor(text=prompts, return_tensors="pt", padding=True, truncation=True)
        out = model.text_model(**toks)
        return model.text_projection(out.pooler_output)

    def embed_image(im):
        inp = processor(images=im, return_tensors="pt")
        out = model.vision_model(**inp)
        return model.visual_projection(out.pooler_output)

    glosses = [it["gloss"] for it in entries]
    # Ensemble text embeddings over templates.
    text_vecs = []
    with T.no_grad():
        for tmpl in TEMPLATES:
            tv = embed_text([tmpl.format(g) for g in glosses])
            tv = tv / tv.norm(dim=-1, keepdim=True)
            text_vecs.append(tv)
        text_emb = T.stack(text_vecs).mean(dim=0)
        text_emb = text_emb / text_emb.norm(dim=-1, keepdim=True)  # [N, D]

    from PIL import Image
    records = []
    n = len(entries)
    for idx, it in enumerate(entries):
        try:
            with Image.open(it["path"]) as im:
                with T.no_grad():
                    iv = embed_image(im.convert("RGB"))
                    iv = iv / iv.norm(dim=-1, keepdim=True)
                sims = (iv @ text_emb.T).squeeze(0)        # [N]
            order = T.argsort(sims, descending=True)
            ranking = order.tolist()
            self_rank = ranking.index(idx) + 1             # 1-based rank of own gloss
            top_i = ranking[0]
            rec = {
                **{k: it[k] for k in ("level", "id", "german", "english", "gloss", "image")},
                "self_sim": round(float(sims[idx]), 4),
                "self_rank": self_rank,
                "top_word": entries[top_i]["german"],
                "top_gloss": entries[top_i]["gloss"],
                "top_sim": round(float(sims[top_i]), 4),
            }
            rec["verdict"] = classify_verdict(rec)
            records.append(rec)
        except Exception as e:
            records.append({**{k: it[k] for k in ("level", "id", "german", "english", "gloss", "image")},
                            "error": str(e), "verdict": "error"})
        if (idx + 1) % 100 == 0:
            print(f"    CLIP {it['level']}: {idx + 1}/{n}", flush=True)
    return records


def classify_verdict(r):
    """High-precision buckets, tuned on CLIP ViT-B/32 cosine ranges.

    The signal for a REAL mismatch is not just a poor self-rank — abstract
    words (prepositions, 'information', 'foreign') rank poorly because the
    image weakly matches *everything*. A genuine wrong-image shows a *large
    margin*: a different, concrete word matches with confidence while the
    mapped word does not.
    """
    rank, self_sim, top_sim = r["self_rank"], r["self_sim"], r["top_sim"]
    margin = top_sim - self_sim
    CONFIDENT = 0.27          # a concrete word CLIP is confident about
    if rank == 1:
        return "match_strong"
    if rank <= 5:
        return "match_ok"
    if rank > 10 and margin >= 0.05 and top_sim >= CONFIDENT:
        return "review_mismatch"   # a different concrete word fits clearly better -> check
    if top_sim < CONFIDENT:
        return "inconclusive"      # weak everywhere -> abstract/un-depictable, can't verify
    return "review_weak"           # mild ambiguity worth a glance


# ---------- HTML review sheet ----------
def thumb_data_uri(path, Image, size=140):
    try:
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((size, size))
            buf = BytesIO()
            im.save(buf, format="JPEG", quality=72)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return ""


def write_html(records, dupes, path, Image):
    order = {"review_mismatch": 0, "review_weak": 1, "inconclusive": 2, "error": 3}
    review = [r for r in records if r.get("verdict") in order]
    review.sort(key=lambda r: (order.get(r["verdict"], 9), -r.get("self_rank", 0)))
    counts = {}
    for r in records:
        counts[r.get("verdict", "?")] = counts.get(r.get("verdict", "?"), 0) + 1

    rows = []
    for r in review:
        uri = thumb_data_uri(os.path.join(ROOT, r["level"], r["image"]), Image)
        rows.append(f"""
        <div class="card {r['verdict']}">
          <img src="{uri}" alt="">
          <div class="meta">
            <div class="word">{html.escape(r['german'])} <span class="g">— {html.escape(r['english'])}</span></div>
            <div class="v">{r['verdict']}</div>
            <div class="d">self-rank {r.get('self_rank','?')} (sim {r.get('self_sim','?')}) ·
                 best match: <b>{html.escape(str(r.get('top_word','')))}</b> (sim {r.get('top_sim','?')})</div>
            <div class="p">{r['level']} · id {r['id']} · {html.escape(r['image'])}</div>
          </div>
        </div>""")

    dupe_rows = "".join(
        f"<li>{html.escape(d['a_word'])} (id {d['a_id']}, {d['a_image']}) ≈ "
        f"{html.escape(d['b_word'])} (id {d['b_id']}, {d['b_image']}) — dist {d['distance']}</li>"
        for d in dupes
    )
    summary = " · ".join(f"{k}: {v}" for k, v in sorted(counts.items()))
    doc = f"""<!doctype html><html><head><meta charset="utf-8">
<title>DeutschSphere — image↔word review</title>
<style>
 body{{background:#0b1120;color:#e2e8f0;font:14px/1.4 system-ui,sans-serif;margin:0;padding:24px}}
 h1{{font-size:18px}} .sum{{color:#94a3b8;margin-bottom:16px}}
 .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}}
 .card{{background:#111827;border-radius:10px;padding:10px;border-left:4px solid #334155}}
 .card.review_mismatch{{border-left-color:#ef4444}} .card.review_weak{{border-left-color:#f59e0b}}
 .card.inconclusive{{border-left-color:#64748b}} .card.error{{border-left-color:#a855f7}}
 .card img{{width:100%;height:140px;object-fit:contain;background:#020617;border-radius:6px}}
 .word{{font-weight:600;margin-top:6px}} .g{{color:#94a3b8;font-weight:400}}
 .v{{font-size:12px;color:#fca5a5}} .d{{font-size:12px;color:#cbd5e1;margin-top:2px}}
 .p{{font-size:11px;color:#64748b;margin-top:2px}}
 ul{{color:#cbd5e1;font-size:13px}}
</style></head><body>
<h1>Image ↔ word semantic review</h1>
<div class="sum">{summary}<br>Showing {len(review)} cards needing human review (matches hidden). Red = likely mismatch, amber = weak, grey = inconclusive/abstract.</div>
<h2>Near-duplicate images ({len(dupes)})</h2><ul>{dupe_rows or '<li>none</li>'}</ul>
<h2>Cards to review</h2>
<div class="grid">{''.join(rows)}</div>
</body></html>"""
    open(path, "w", encoding="utf-8").write(doc)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", choices=LEVELS)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--report", default=os.path.join(ROOT, "scripts", "image_check_report.json"))
    ap.add_argument("--html", default=os.path.join(ROOT, "scripts", "image_check_review.html"))
    ap.add_argument("--model", default=CLIP_MODEL)
    args = ap.parse_args()

    try:
        import torch
        from PIL import Image
        import imagehash
        from transformers import CLIPModel, CLIPProcessor
    except Exception as e:
        print(f"[skip] ML deps unavailable ({e!s}). Use the D: venv: "
              f"D:\\deutschsphere-imgverify\\venv\\Scripts\\python.exe")
        return 0

    levels = [args.level] if args.level else LEVELS
    entries = []
    for lvl in levels:
        entries.extend(load_entries(lvl))
    if args.limit:
        entries = entries[: args.limit]
    print(f"Loaded {len(entries)} entries with on-disk images across {levels}.")

    print("Layer 1: perceptual-hash duplicate sweep...")
    dupes = duplicate_sweep(entries, Image, imagehash)
    print(f"  near-duplicate pairs (Hamming <= {PHASH_NEAR}): {len(dupes)}")

    print(f"Layer 2: loading CLIP ({args.model}) ...")
    model = CLIPModel.from_pretrained(args.model)
    processor = CLIPProcessor.from_pretrained(args.model)
    model.eval()
    records = clip_verify(entries, torch, model, processor)

    counts = {}
    for r in records:
        counts[r.get("verdict", "?")] = counts.get(r.get("verdict", "?"), 0) + 1
    print("\nVerdict summary:")
    for k in ("match_strong", "match_ok", "review_weak", "review_mismatch", "inconclusive", "error"):
        if k in counts:
            print(f"  {k:16s} {counts[k]}")

    json.dump({"counts": counts, "near_duplicates": dupes, "records": records},
              open(args.report, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"[report] {args.report}")
    write_html(records, dupes, args.html, Image)
    print(f"[review sheet] {args.html}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
