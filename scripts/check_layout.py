"""Enforce the single canonical repository layout (docs/decisions.md D-012).

Fails when:
- a retired path from the original scaffold is tracked again;
- a function named like a preprocessing entry point is defined outside the shared module
  (contracts/README.md section 4: one preprocessing implementation);
- a FastAPI application is created outside api/ (one backend).

Run: python3 scripts/check_layout.py  (CI and pre-commit run it too)
"""

from __future__ import annotations

import ast
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RETIRED = {
    "src/": "use api/ (backend) and ml/ (ML code)",
    "configs/": "use config/*.toml",
    "docs/contracts/": "use contracts/ (README + Pydantic models)",
    "docs/adr/": "use docs/decisions.md",
    "models/": "checkpoints live in artifacts/ (git-ignored)",
    "scaffold.sh": "the layout is already scaffolded",
    ".github/workflows/web.yml": "web checks run in .github/workflows/ci.yml",
}
PREPROCESS_HOME = "ml/kneescope_ml/preprocess.py"
API_HOME = "api/"


def tracked() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True)
    return [p for p in out.stdout.decode().split("\0") if p]


def problems(files: list[str], root: Path = ROOT) -> list[str]:
    found: list[str] = []
    for rel in files:
        for old, use in RETIRED.items():
            if rel == old or rel.startswith(old):
                found.append(f"{rel}: retired path ({use})")
        if not rel.endswith(".py") or rel.startswith("tests/"):
            continue
        path = root / rel
        if not path.exists():
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.FunctionDef)
                and node.name.startswith("preprocess")
                and rel != PREPROCESS_HOME
            ):
                found.append(
                    f"{rel}:{node.lineno}: '{node.name}' — preprocessing lives only in {PREPROCESS_HOME}"
                )
            if (
                isinstance(node, ast.Call)
                and getattr(node.func, "id", None) == "FastAPI"
                and not rel.startswith(API_HOME)
            ):
                found.append(f"{rel}:{node.lineno}: FastAPI app outside {API_HOME}")
    return found


def main() -> int:
    found = problems(tracked())
    for p in found:
        print(f"LAYOUT {p}")
    print(f"layout: {'FAIL' if found else 'ok'}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
