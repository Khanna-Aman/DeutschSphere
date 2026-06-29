"""
Image File Renaming Script
===========================
After the wordlist deduplication/renumbering, image files need to be renamed
to match the new sequential IDs. This script handles A1, A2, and B1 image directories.

For each level:
1. Load the backup (original) wordlist to get old ordering
2. Load the new wordlist to get new ordering
3. Build old_id -> new_id mapping for original entries
4. Rename image files accordingly (both .webp and .svg)
"""

import json
import os
import shutil
from pathlib import Path

BASE = Path(r"d:\Aman\_________Projects\A1-B1_German")
BACKUP_TS = "20260629_133308"

def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def fix_images_for_level(level):
    """Rename image files to match new sequential IDs for a given level."""
    print(f"\n--- Fixing images for {level.upper()} ---")

    backup_path = BASE / 'scripts' / 'backups' / f'{level}_wordlist_backup_{BACKUP_TS}.json'
    new_path = BASE / level / 'wordlist.json'
    images_dir = BASE / level / 'images'

    old_data = load_json(backup_path)
    new_data = load_json(new_path)

    # Build a mapping from (german, word_class) -> old_id for the backup
    # This maps content to original image
    old_content_to_id = {}
    for entry in old_data:
        key = (entry['german'], entry.get('word_class', ''))
        old_content_to_id[key] = entry['id']

    # For each entry in the new list, find its old ID to get the original image
    rename_pairs = []  # (old_id, new_id) pairs for renaming

    for new_entry in new_data:
        new_id = new_entry['id']
        key = (new_entry['german'], new_entry.get('word_class', ''))
        old_id = old_content_to_id.get(key)

        if old_id is not None and old_id != new_id:
            rename_pairs.append((old_id, new_id))
        # If old_id == new_id, no rename needed
        # If old_id is None (new entry), no original image exists

    print(f"  Entries needing image rename: {len(rename_pairs)}")

    # We need to rename carefully to avoid conflicts
    # Use a two-pass approach: rename to temp names first, then to final names

    suffixes = ['.webp', '.svg']
    temp_prefix = '__temp_rename_'

    # Pass 1: Rename to temp names
    renamed_to_temp = []
    for (old_id, new_id) in rename_pairs:
        for suffix in suffixes:
            old_file = images_dir / f'card_{old_id}{suffix}'
            temp_file = images_dir / f'{temp_prefix}{old_id}{suffix}'
            if old_file.exists():
                os.rename(old_file, temp_file)
                renamed_to_temp.append((temp_file, images_dir / f'card_{new_id}{suffix}'))

    # Pass 2: Rename from temp to final names
    for (temp_file, final_file) in renamed_to_temp:
        if temp_file.exists():
            # If final_file already exists (from a different card that wasn't renamed),
            # we overwrite it (that card's old image is no longer needed since the card was removed)
            os.rename(temp_file, final_file)

    # Clean up any remaining temp files
    for f in images_dir.glob(f'{temp_prefix}*'):
        print(f"  WARNING: Leftover temp file: {f.name}")

    # Remove image files for removed entries (old IDs not in new list)
    new_ids = {e['id'] for e in new_data}
    old_ids_in_backup = {e['id'] for e in old_data}
    removed_ids = old_ids_in_backup - {old_content_to_id.get((e['german'], e.get('word_class','')), -1) for e in new_data}

    removed_count = 0
    for old_id in removed_ids:
        for suffix in suffixes:
            f = images_dir / f'card_{old_id}{suffix}'
            if f.exists():
                f.unlink()
                removed_count += 1

    print(f"  Removed {removed_count} orphaned image files")

    # Verify: count remaining image files
    remaining_webp = len(list(images_dir.glob('card_*.webp')))
    remaining_svg = len(list(images_dir.glob('card_*.svg')))
    print(f"  Remaining images: {remaining_webp} webp, {remaining_svg} svg")
    print(f"  New entry count: {len(new_data)}")


def main():
    print("Fixing image files after wordlist renumbering...")
    for level in ['a1', 'a2', 'b1']:
        fix_images_for_level(level)
    print("\nDone! Image files updated.")


if __name__ == '__main__':
    main()
