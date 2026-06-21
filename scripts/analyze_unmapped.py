"""
Analyze all wordlists and identify unmapped words.
Outputs a JSON file with all words grouped by theme for systematic mapping.
"""
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Import mapping rules from generate_assets
sys.path.insert(0, SCRIPT_DIR)
from generate_assets import MAPPING_RULES, matches_keyword

def map_word_to_codepoint(card):
    english_lower = card.get('english', '').lower().strip()
    german_lower = card.get('german', '').lower().strip()
    for eng_kws, ger_kws, codepoint in MAPPING_RULES:
        for kw in eng_kws:
            if matches_keyword(kw, english_lower, is_german=False):
                return codepoint
        for kw in ger_kws:
            if matches_keyword(kw, german_lower, is_german=True):
                return codepoint
    # substring fallback
    for eng_kws, ger_kws, codepoint in MAPPING_RULES:
        for kw in eng_kws:
            if len(kw) >= 4 and kw in english_lower:
                return codepoint
        for kw in ger_kws:
            if len(kw) >= 4 and kw in german_lower:
                return codepoint
    return None

all_words = []
for level in ['a1', 'a2', 'b1']:
    path = os.path.join(PROJECT_ROOT, level, 'wordlist.json')
    if not os.path.exists(path):
        print(f"WARNING: {path} not found")
        continue
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    mapped = 0
    unmapped = 0
    unmapped_words = []
    for item in data:
        german = item.get('german', '')
        english = item.get('english', '')
        theme = item.get('theme', '')
        word_class = item.get('word_class', '')
        card = {'german': german, 'english': english, 'theme': theme, 'word_class': word_class}
        cp = map_word_to_codepoint(card)
        if cp:
            mapped += 1
        else:
            unmapped += 1
            unmapped_words.append({
                'german': german,
                'english': english,
                'theme': theme,
                'word_class': word_class,
                'id': item.get('id', 0)
            })
    
    print(f"\n=== {level.upper()} ===")
    print(f"Total: {len(data)}, Mapped: {mapped}, Unmapped: {unmapped}")
    print(f"Coverage: {mapped/len(data)*100:.1f}%")
    
    # Group unmapped by theme
    by_theme = {}
    for w in unmapped_words:
        t = w['theme'] or 'Unknown'
        by_theme.setdefault(t, []).append(w)
    
    print(f"\nUnmapped by theme:")
    for theme, words in sorted(by_theme.items()):
        print(f"  {theme}: {len(words)} words")
        for w in words[:3]:
            print(f"    - {w['german']} = {w['english']}")
        if len(words) > 3:
            print(f"    ... and {len(words)-3} more")
    
    # Save unmapped for analysis
    output_path = os.path.join(PROJECT_ROOT, 'scripts', f'unmapped_{level}.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(unmapped_words, f, indent=2, ensure_ascii=False)
    print(f"\nSaved unmapped words to {output_path}")

print("\n\n=== SUMMARY ===")
print("Run complete. Check unmapped_*.json files for detailed word lists.")
