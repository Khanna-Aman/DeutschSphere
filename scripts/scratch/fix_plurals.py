#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fix plurals that were incorrectly set to None by the audit script."""
import json, glob, sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# Load current (damaged) data
with open('a1/wordlist.json', 'r', encoding='utf-8') as f:
    current = json.load(f)

# Load latest backup
backups = sorted(glob.glob('scripts/backups/a1_wordlist_backup_*.json'))
if not backups:
    print("ERROR: No backups found!")
    sys.exit(1)

latest_backup = backups[-1]
print(f'Using backup: {latest_backup}')

with open(latest_backup, 'r', encoding='utf-8') as f:
    backup = json.load(f)

# Build backup lookup by ID
backup_map = {w['id']: w for w in backup}

# Find and fix entries where plural was wiped to None but backup had a value
fixed = 0
for word in current:
    wid = word['id']
    if wid in backup_map:
        current_plural = word.get('plural')
        backup_plural = backup_map[wid].get('plural')
        
        # Restore if current is None but backup had a real value
        if current_plural is None and backup_plural is not None:
            print(f"  [RESTORE] ID {wid} '{word['german']}': None -> '{backup_plural}'")
            word['plural'] = backup_plural
            fixed += 1

print(f'\nRestored {fixed} plurals.')

with open('a1/wordlist.json', 'w', encoding='utf-8') as f:
    json.dump(current, f, ensure_ascii=False, indent=2)
print('Saved fixed a1/wordlist.json')
