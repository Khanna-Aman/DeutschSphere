#!/usr/bin/env python
# -*- coding: utf-8 -*-

with open('cookies.txt', 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Strip any leading spaces or BOMs
clean_content = content.strip().lstrip('\ufeff')

with open('cookies.txt', 'w', encoding='utf-8') as f:
    f.write(clean_content)

print("Successfully stripped BOM and trimmed cookies.txt!")
print("Starts with \\ufeff:", clean_content.startswith('\ufeff'))
