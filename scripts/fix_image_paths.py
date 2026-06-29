"""
Fix image/image_path fields in all three wordlist JSON files.

Problem: fix_wordlists.py Step 7 overwrote image/image_path with the new
sequential ID as .webp for every entry that had any image. This broke B1
entries that only had SVG files (card_595+), and caused wrong images to
show for A1/A2 entries whose positions shifted after duplicate removal.

Fix: restore each entry's original image/image_path by looking up
(german, word_class) in the corresponding backup file.
"""

import json
from pathlib import Path

BASE = Path(r"d:\Aman\_________Projects\A1-B1_German")
BACKUP_TS = "20260629_133308"


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  Saved {len(data)} entries to {path}")


def fix_level(level):
    print(f"\n--- {level.upper()} ---")
    current_path = BASE / level / 'wordlist.json'
    backup_path  = BASE / 'scripts' / 'backups' / f'{level}_wordlist_backup_{BACKUP_TS}.json'

    current = load_json(current_path)
    backup  = load_json(backup_path)

    # Build lookup: (german, word_class) -> (image, image_path) from backup
    backup_images = {}
    for e in backup:
        key = (e['german'], e.get('word_class', ''))
        backup_images[key] = {
            'image':      e.get('image'),
            'image_path': e.get('image_path'),
        }

    restored = 0
    not_found = 0
    for entry in current:
        key = (entry['german'], entry.get('word_class', ''))
        if key in backup_images:
            orig = backup_images[key]
            entry['image']      = orig['image']
            entry['image_path'] = orig['image_path']
            restored += 1
        else:
            # New entry (added in fix_wordlists.py) — leave image=None
            entry['image']      = None
            entry['image_path'] = None
            not_found += 1

    print(f"  Restored: {restored}, New entries (no image): {not_found}")

    # Verify: count broken refs
    broken = 0
    null_img = 0
    for e in current:
        ip = e.get('image_path') or e.get('image')
        if not ip:
            null_img += 1
        elif not (BASE / level / ip).exists():
            broken += 1

    print(f"  Null image: {null_img}, Broken refs: {broken}")
    if broken > 0:
        sample = [e for e in current
                  if (e.get('image_path') or e.get('image'))
                  and not (BASE / level / (e.get('image_path') or e.get('image'))).exists()]
        for s in sample[:3]:
            print(f"    BROKEN: '{s['german']}' image='{s.get('image')}' image_path='{s.get('image_path')}'")

    save_json(current_path, current)


def main():
    print("Restoring original image/image_path values from backups...")
    for level in ['a1', 'a2', 'b1']:
        fix_level(level)
    print("\nDone! Re-run the CSV export after this.")


if __name__ == '__main__':
    main()
