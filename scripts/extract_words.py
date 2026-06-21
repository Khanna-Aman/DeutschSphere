"""Extract all words from wordlists - simple extraction, no matching."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

for level in ['a1', 'a2', 'b1']:
    path = os.path.join(ROOT, level, 'wordlist.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    words = []
    for item in data:
        words.append(f"{item.get('german','')}\t{item.get('english','')}\t{item.get('theme','')}\t{item.get('word_class','')}")
    
    out = os.path.join(ROOT, 'scripts', f'words_{level}.tsv')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(words))
    
    print(f"{level}: {len(data)} words extracted to {out}")
