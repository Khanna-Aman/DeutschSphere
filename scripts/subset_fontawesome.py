#!/usr/bin/env python3
"""Regenerate the subset Font Awesome webfonts from the full source fonts.

Run this whenever a new `fa-*` icon class is added to index.html or js/*.js.
It scans those files for used icon classes, maps each to its codepoint via
fonts/fontawesome.min.css, and subsets fonts/webfonts/fa-solid-900.woff2 and
fa-brands-400.woff2 (kept as full-glyph source files) down to only the
glyphs actually used, writing fa-solid-900.subset.woff2 /
fa-brands-400.subset.woff2 — the files index.html and fontawesome.min.css
reference. Requires `fonttools` (pyftsubset): pip install fonttools.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONTS_CSS = ROOT / "fonts" / "fontawesome.min.css"
WEBFONTS = ROOT / "fonts" / "webfonts"
SCAN_FILES = [ROOT / "index.html", *sorted((ROOT / "js").glob("*.js"))]

SKIP_MODIFIERS = {
    "fa-solid", "fa-regular", "fa-brands", "fa-fw", "fa-spin", "fa-lg",
    "fa-xs", "fa-sm", "fa-xl", "fa-2xl", "fa-2x", "fa-3x", "fa-pulse",
}


def used_icon_classes() -> set[str]:
    names = set()
    for path in SCAN_FILES:
        text = path.read_text(encoding="utf-8")
        for m in re.finditer(r"fa-[a-z0-9-]+", text):
            name = m.group(0)
            if name not in SKIP_MODIFIERS:
                names.add(name)
    return names


def name_to_codepoint_map(css: str) -> dict[str, str]:
    mapping = {}
    for selectors, cp in re.findall(r'([^{}]+)\{content:"\\([0-9a-fA-F]+)"\}', css):
        for sel in selectors.split(","):
            sel = sel.strip()
            m = re.match(r"\.(fa-[a-z0-9-]+):before$", sel)
            if m:
                mapping[m.group(1)] = cp
    return mapping


def font_codepoints(woff2_path: Path) -> set[int]:
    from fontTools.ttLib import TTFont
    cmap = TTFont(str(woff2_path)).getBestCmap()
    return set(cmap)


def subset(src: Path, out: Path, codepoints: list[int]) -> None:
    if not codepoints:
        raise SystemExit(f"No codepoints to subset for {src.name} — refusing to write an empty font")
    unicodes = ",".join(f"U+{cp:04X}" for cp in codepoints)
    subprocess.run(
        [
            "pyftsubset", str(src),
            f"--output-file={out}",
            f"--unicodes={unicodes}",
            "--layout-features=*",
            "--flavor=woff2",
            "--no-hinting",
        ],
        check=True,
    )


def main() -> None:
    css = FONTS_CSS.read_text(encoding="utf-8")
    used = used_icon_classes()
    name_to_cp = name_to_codepoint_map(css)

    missing = sorted(n for n in used if n not in name_to_cp)
    if missing:
        print(f"ERROR: these classes are used in source but do not exist in Font Awesome Free: {missing}", file=sys.stderr)
        print("(check for typos / Pro-only icons — see fonts/fontawesome.min.css for available names)", file=sys.stderr)
        sys.exit(1)

    solid_src = WEBFONTS / "fa-solid-900.woff2"
    brands_src = WEBFONTS / "fa-brands-400.woff2"
    solid_cps_available = font_codepoints(solid_src)
    brands_cps_available = font_codepoints(brands_src)

    used_cps = {int(name_to_cp[n], 16) for n in used}
    solid_cps = sorted(cp for cp in used_cps if cp in solid_cps_available)
    brands_cps = sorted(cp for cp in used_cps if cp in brands_cps_available)

    unresolved = used_cps - set(solid_cps) - set(brands_cps)
    if unresolved:
        print(f"ERROR: codepoints not found in either source font: {[f'{cp:04X}' for cp in sorted(unresolved)]}", file=sys.stderr)
        sys.exit(1)

    subset(solid_src, WEBFONTS / "fa-solid-900.subset.woff2", solid_cps)
    subset(brands_src, WEBFONTS / "fa-brands-400.subset.woff2", brands_cps)
    print(f"OK: {len(used)} icon classes used -> solid {len(solid_cps)} glyphs, brands {len(brands_cps)} glyphs")


if __name__ == "__main__":
    main()
