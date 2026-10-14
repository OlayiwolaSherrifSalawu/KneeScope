"""Check Markdown docs: local links resolve, and published docs contain no placeholders.

Templates (model card, data audit) are allowed placeholders while they say "TEMPLATE".
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {"node_modules", ".venv", ".git", ".claude", "artifacts", "data", "dist"}
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
PLACEHOLDER = re.compile(r"\bTBD\b|\bTODO\b|lorem ipsum", re.IGNORECASE)


def markdown_files() -> list[Path]:
    return [p for p in ROOT.rglob("*.md") if not SKIP_DIRS & set(p.relative_to(ROOT).parts)]


def main() -> int:
    errors: list[str] = []
    for md in markdown_files():
        text = md.read_text(encoding="utf-8")
        for target in LINK.findall(text):
            if re.match(r"^[a-z]+:", target) or target.startswith("#"):
                continue
            path = target.split("#", 1)[0]
            path = re.sub(r":\d+$", "", path)
            if path and not (md.parent / path).resolve().exists():
                errors.append(f"{md.relative_to(ROOT)}: broken link {target}")
        quoting = md.is_relative_to(ROOT / "docs" / "issues")  # issue bodies quote the words
        if not quoting and "TEMPLATE" not in text[:400] and PLACEHOLDER.search(text):
            errors.append(f"{md.relative_to(ROOT)}: contains a placeholder (TBD/TODO)")
    for e in errors:
        print(e)
    print(f"docs: {'FAIL' if errors else 'ok'} ({len(markdown_files())} files)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
