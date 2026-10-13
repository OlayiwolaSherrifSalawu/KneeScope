"""D-012: the canonical layout is enforced."""

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("layout", ROOT / "scripts/check_layout.py")
assert spec and spec.loader
layout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(layout)


def test_repository_follows_canonical_layout():
    assert layout.problems(layout.tracked()) == []


def test_guard_flags_retired_paths_and_duplicates(tmp_path):
    (tmp_path / "ml").mkdir()
    (tmp_path / "ml" / "other.py").write_text("def preprocess_exam(v):\n    return v\n")
    (tmp_path / "app.py").write_text("from fastapi import FastAPI\napp = FastAPI()\n")
    found = "\n".join(
        layout.problems(["src/knee_api/main.py", "configs/baseline.yaml", "ml/other.py", "app.py"], tmp_path)
    )
    assert "src/knee_api/main.py: retired path" in found
    assert "configs/baseline.yaml: retired path" in found
    assert "preprocess_exam" in found
    assert "FastAPI app outside api/" in found
