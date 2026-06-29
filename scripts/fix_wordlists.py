"""
Comprehensive German A1-B1 Flashcard Fix Script
================================================
Fixes:
1. A1 internal duplicates (auf sein x2, aus x2, und x2)
2. Adds 8 truly absent A1 words (pronouns, anklicken, ankreuzen, etc.)
3. Moves A1 words out of A2 into A1 (33+ words)
4. Deduplicates A2 (removes words already in A1)
5. Deduplicates B1 (removes words already in A1 or A2)
6. Renumbers IDs sequentially, updates image paths
"""

import json
import re
import os
import shutil
from pathlib import Path

BASE = Path(r"d:\Aman\_________Projects\A1-B1_German")

def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(data)} entries to {path}")

def normalize(word):
    """Normalize a German word for comparison purposes."""
    w = word.strip()
    # Remove parenthetical reflexive
    w = re.sub(r'^\(sich\)\s+', '', w)
    w = re.sub(r'^sich\s+', '', w)
    # Remove article
    w = re.sub(r'^(der|die|das)\s+', '', w)
    # Remove everything after comma (plural info)
    w = re.sub(r',.*$', '', w)
    # Remove parenthetical clarifications
    w = re.sub(r'\(.*?\)', '', w)
    # Remove trailing dash (word stems)
    w = re.sub(r'-$', '', w)
    # Normalize spaces
    w = re.sub(r'\s+', ' ', w).strip()
    return w.lower()

def make_key(entry):
    """Create a dedup key from (normalized_word, word_class)."""
    return (normalize(entry['german']), entry.get('word_class', '').lower())

def renumber(entries, level_dir):
    """Renumber entries sequentially. Image paths are preserved (files not renamed)."""
    for i, entry in enumerate(entries, 1):
        entry['id'] = i
        # Do NOT change image/image_path — keep original file references
        # so existing image files still load correctly
    return entries

# ============================================================
# LOAD ALL THREE LISTS
# ============================================================
print("Loading wordlists...")
a1 = load_json(BASE / 'a1' / 'wordlist.json')
a2 = load_json(BASE / 'a2' / 'wordlist.json')
b1 = load_json(BASE / 'b1' / 'wordlist.json')

print(f"A1: {len(a1)}, A2: {len(a2)}, B1: {len(b1)}")

# ============================================================
# STEP 1: FIX A1 INTERNAL DUPLICATES
# ============================================================
print("\n--- Step 1: Fixing A1 internal duplicates ---")

# Remove duplicate "auf sein" (keep id:21, remove id:22)
# Merge example sentences from both
auf_sein_entries = [e for e in a1 if e['german'] == 'auf sein']
if len(auf_sein_entries) == 2:
    # Keep id:21, merge example from id:22 into antonym or notes
    keep = next(e for e in auf_sein_entries if e['id'] == 21)
    remove = next(e for e in auf_sein_entries if e['id'] == 22)
    # Keep the better entry (id:21 has "Die Wohnung ist auf")
    a1 = [e for e in a1 if not (e['german'] == 'auf sein' and e['id'] == 22)]
    print(f"  Removed duplicate 'auf sein' (id:22)")

# Remove duplicate "aus" (keep id:28, remove id:29)
aus_entries = [e for e in a1 if e['german'] == 'aus']
if len(aus_entries) == 2:
    a1 = [e for e in a1 if not (e['german'] == 'aus' and e['id'] == 29)]
    print(f"  Removed duplicate 'aus' (id:29)")

# Remove duplicate "und" (keep id:556, remove id:557 - exact same)
und_entries = [e for e in a1 if e['german'] == 'und']
if len(und_entries) == 2:
    a1 = [e for e in a1 if not (e['german'] == 'und' and e['id'] == 557)]
    print(f"  Removed duplicate 'und' (id:557)")

# Check for duplicate "die Briefmarke"
briefmarke_entries = [e for e in a1 if e['german'] == 'die Briefmarke']
if len(briefmarke_entries) > 1:
    # Keep the first one
    keep_id = briefmarke_entries[0]['id']
    a1 = [e for e in a1 if not (e['german'] == 'die Briefmarke' and e['id'] != keep_id)]
    print(f"  Removed duplicate 'die Briefmarke'")

print(f"  A1 after internal dedup: {len(a1)} entries")

# ============================================================
# STEP 2: ADD 8 TRULY ABSENT A1 WORDS (from official A1 list)
# ============================================================
print("\n--- Step 2: Adding absent A1 words ---")

# Get current max ID to assign new IDs
max_a1_id = max(e['id'] for e in a1)

# These 8 new entries are based on official A1 wordlist data from Goethe-Institut
new_a1_entries = [
    {
        "german": "ihr/ihm/ihn",
        "word_class": "Pronomen",
        "gender": None,
        "plural": None,
        "verb_conjugation": None,
        "adjective_forms": None,
        "english": "her / him (dative: to him/her, accusative: him)",
        "pronunciation": "eer / eem / een",
        "theme": "Grammatik, Pronomen & Struktur",
        "antonym": None,
        "example_de": "Gib ihr bitte das Buch. Ruf ihn bitte an.",
        "example_en": "Please give her the book. Please call him.",
        "image": None,
        "image_tier": "B",
        "image_path": None
    },
    {
        "german": "circa/ca.",
        "word_class": "Andere",
        "gender": None,
        "plural": None,
        "verb_conjugation": None,
        "adjective_forms": None,
        "english": "approximately / about",
        "pronunciation": "tseer-kah",
        "theme": "Grammatik, Pronomen & Struktur",
        "antonym": None,
        "example_de": "Von Mainz nach Frankfurt sind es circa fünfzig Kilometer.",
        "example_en": "From Mainz to Frankfurt it is approximately fifty kilometers.",
        "image": None,
        "image_tier": "B",
        "image_path": None
    },
    {
        "german": "anklicken",
        "word_class": "Verb",
        "gender": None,
        "plural": None,
        "verb_conjugation": None,
        "adjective_forms": None,
        "english": "to click (on)",
        "pronunciation": "ahn-klik-en",
        "theme": "Technologie & Kommunikation",
        "antonym": None,
        "example_de": "Da musst du dieses Wort anklicken.",
        "example_en": "You have to click on that word there.",
        "image": None,
        "image_tier": "B",
        "image_path": None
    },
    {
        "german": "ankreuzen",
        "word_class": "Verb",
        "gender": None,
        "plural": None,
        "verb_conjugation": None,
        "adjective_forms": None,
        "english": "to tick / to check (a box)",
        "pronunciation": "ahn-kroy-tsen",
        "theme": "Ausbildung, Schule & Studium",
        "antonym": None,
        "example_de": "Auf dem Formular müssen Sie an mehreren Stellen etwas ankreuzen.",
        "example_en": "On the form you must tick in several places.",
        "image": None,
        "image_tier": "B",
        "image_path": None
    },
    {
        "german": "(sich) anziehen",
        "word_class": "Verb",
        "gender": None,
        "plural": None,
        "verb_conjugation": None,
        "adjective_forms": None,
        "english": "to get dressed / to put on (clothes)",
        "pronunciation": "ahn-tsee-en",
        "theme": "Allgemeine Aktivitäten & Verben",
        "antonym": "(sich) ausziehen",
        "example_de": "Ich muss mich noch anziehen.",
        "example_en": "I still have to get dressed.",
        "image": None,
        "image_tier": "B",
        "image_path": None
    },
    {
        "german": "(sich) ausziehen",
        "word_class": "Verb",
        "gender": None,
        "plural": None,
        "verb_conjugation": None,
        "adjective_forms": None,
        "english": "to take off (clothes) / to undress / to move out",
        "pronunciation": "ows-tsee-en",
        "theme": "Allgemeine Aktivitäten & Verben",
        "antonym": "(sich) anziehen",
        "example_de": "Zieh die Schuhe aus, bitte!",
        "example_en": "Take your shoes off, please!",
        "image": None,
        "image_tier": "B",
        "image_path": None
    },
    {
        "german": "Rad fahren",
        "word_class": "Verb",
        "gender": None,
        "plural": None,
        "verb_conjugation": None,
        "adjective_forms": None,
        "english": "to ride a bike / to cycle",
        "pronunciation": "raht fah-ren",
        "theme": "Freizeit, Hobbys & Unterhaltung",
        "antonym": None,
        "example_de": "Das Kind kann schon Rad fahren.",
        "example_en": "The child can already ride a bike.",
        "image": None,
        "image_tier": "B",
        "image_path": None
    },
    {
        "german": "der Grad",
        "word_class": "Nomen",
        "gender": "der",
        "plural": "die Grad",
        "verb_conjugation": None,
        "adjective_forms": None,
        "english": "degree (temperature)",
        "pronunciation": "graht",
        "theme": "Umwelt, Natur & Wetter",
        "antonym": None,
        "example_de": "Heute haben wir dreißig Grad.",
        "example_en": "Today it is thirty degrees.",
        "image": None,
        "image_tier": "B",
        "image_path": None
    },
]

# Only add entries NOT already in A1 (by normalized form)
a1_keys = {make_key(e) for e in a1}
added = []
for entry in new_a1_entries:
    key = make_key(entry)
    if key not in a1_keys:
        max_a1_id += 1
        entry['id'] = max_a1_id
        a1.append(entry)
        a1_keys.add(key)
        added.append(entry['german'])
        print(f"  Added: '{entry['german']}'")
    else:
        print(f"  Already exists: '{entry['german']}'")

print(f"  Added {len(added)} new A1 entries")

# ============================================================
# STEP 3: MOVE OFFICIAL A1 WORDS FROM A2 → A1
# ============================================================
print("\n--- Step 3: Moving A1 words from A2 to A1 ---")

# These are words officially in A1 that are currently ONLY in A2 (not in A1)
# From our analysis: gern, Lieblings-, ab, aber, abfahren, die Abfahrt, abgeben, abholen,
# Achtung, die Adresse, all-, allein, also, alt, das Alter, anbieten, ander-, der Anfang,
# anfangen, das Angebot, ankommen, die Ankunft, anmachen, sich anmelden, die Anmeldung,
# der Anruf, der Anrufbeantworter, anrufen, dort, sich duschen, sich freuen, der Satz,
# sich treffen, sich vorstellen

# Refresh A1 keys after step 2
a1_keys = {make_key(e) for e in a1}

# Find A2 entries for words that should be in A1 but aren't
# We'll use the official A1 word list to identify these
official_a1_base_words = {
    'ab', 'aber', 'abfahren', 'abfahrt', 'abgeben', 'abholen', 'absender',
    'achtung', 'adresse', 'all', 'allein', 'also', 'alt', 'alter',
    'anbieten', 'ander', 'anfang', 'anfangen', 'angebot', 'anklicken',
    'ankommen', 'ankreuzen', 'ankunft', 'anmachen', 'anmelden', 'anmeldung',
    'anrede', 'anruf', 'anrufbeantworter', 'anrufen', 'anziehen', 'ausziehen',
    'bekannte', 'circa', 'dort', 'duschen', 'feierabend', 'feiertag',
    'freuen', 'gerne', 'gern', 'grad', 'lieblings', 'rad fahren', 'satz',
    'treffen', 'vorstellen', 'weh tun'
}

to_remove_from_a2 = []
moved_to_a1 = []

for a2_entry in a2:
    norm = normalize(a2_entry['german'])
    key = make_key(a2_entry)
    # If this word is officially A1 and NOT yet in A1
    if norm in official_a1_base_words and key not in a1_keys:
        # Move to A1
        new_entry = dict(a2_entry)
        max_a1_id += 1
        new_entry['id'] = max_a1_id
        new_entry['image'] = None
        new_entry['image_path'] = None
        a1.append(new_entry)
        a1_keys.add(key)
        to_remove_from_a2.append(a2_entry['id'])
        moved_to_a1.append(a2_entry['german'])
        print(f"  Moved '{a2_entry['german']}' from A2 to A1")

print(f"  Moved {len(moved_to_a1)} entries from A2 to A1")
print(f"  A1 now has {len(a1)} entries")

# ============================================================
# STEP 4: MOVE OFFICIAL A1 WORDS FROM B1 → A1 (if not in A2)
# ============================================================
print("\n--- Step 4: Moving A1 words from B1 to A1 ---")

# Refresh A1 keys
a1_keys = {make_key(e) for e in a1}
a2_keys = {make_key(e) for e in a2}
to_remove_from_b1 = []

for b1_entry in b1:
    norm = normalize(b1_entry['german'])
    key = make_key(b1_entry)
    # If this word is officially A1 and NOT in A1 or A2
    if norm in official_a1_base_words and key not in a1_keys and key not in a2_keys:
        new_entry = dict(b1_entry)
        max_a1_id += 1
        new_entry['id'] = max_a1_id
        new_entry['image'] = None
        new_entry['image_path'] = None
        a1.append(new_entry)
        a1_keys.add(key)
        to_remove_from_b1.append(b1_entry['id'])
        print(f"  Moved '{b1_entry['german']}' from B1 to A1")

print(f"  A1 now has {len(a1)} entries")

# ============================================================
# STEP 5: DEDUPLICATE A2 (remove words already in A1)
# ============================================================
print("\n--- Step 5: Deduplicating A2 ---")

# Refresh A1 keys (now complete)
a1_keys = {make_key(e) for e in a1}

a2_before = len(a2)
a2_new = []
a2_removed = []
for entry in a2:
    key = make_key(entry)
    if key in a1_keys:
        a2_removed.append(entry['german'])
    else:
        a2_new.append(entry)

a2 = a2_new
print(f"  A2: {a2_before} -> {len(a2)} (removed {len(a2_removed)} A1-level duplicates)")

# ============================================================
# STEP 6: DEDUPLICATE B1 (remove words already in A1 or A2)
# ============================================================
print("\n--- Step 6: Deduplicating B1 ---")

a2_keys_new = {make_key(e) for e in a2}

b1_before = len(b1)
b1_new = []
b1_removed = []
for entry in b1:
    key = make_key(entry)
    if key in a1_keys or key in a2_keys_new:
        b1_removed.append(entry['german'])
    else:
        b1_new.append(entry)

b1 = b1_new
print(f"  B1: {b1_before} -> {len(b1)} (removed {len(b1_removed)} A1/A2-level duplicates)")

# ============================================================
# STEP 7: RENUMBER IDs AND UPDATE IMAGE PATHS
# ============================================================
print("\n--- Step 7: Renumbering IDs ---")

for level_entries in [a1, a2, b1]:
    for i, entry in enumerate(level_entries, 1):
        entry['id'] = i
        if entry.get('image') or entry.get('image_path'):
            entry['image'] = f"images/card_{i}.webp"
            entry['image_path'] = f"images/card_{i}.webp"
        # Leave null entries as null

print(f"  A1: IDs 1-{len(a1)}")
print(f"  A2: IDs 1-{len(a2)}")
print(f"  B1: IDs 1-{len(b1)}")

# ============================================================
# STEP 8: SAVE RESULTS
# ============================================================
print("\n--- Step 8: Saving results ---")

save_json(BASE / 'a1' / 'wordlist.json', a1)
save_json(BASE / 'a2' / 'wordlist.json', a2)
save_json(BASE / 'b1' / 'wordlist.json', b1)

# ============================================================
# SUMMARY
# ============================================================
print("\n=== SUMMARY ===")
print(f"A1: {len(a1)} entries (official target: ~650-686)")
print(f"A2: {len(a2)} entries (official target: ~620-650 new A2 words)")
print(f"B1: {len(b1)} entries (official target: ~1000-1100 new B1 words)")
print(f"Total: {len(a1) + len(a2) + len(b1)} entries")
print("\nDone! Remember to:")
print("1. Bump WORDLIST_CACHE_VERSION in app.js")
print("2. Regenerate CSV files")
print("3. Handle renamed image files (if needed)")
