"""Dataset labels must never reach preprocessing, the model, or the prediction path."""

import ast
import inspect
from pathlib import Path

from kneescope_api import service

ROOT = Path(__file__).resolve().parents[1]
INFERENCE_MODULES = [
    "ml/kneescope_ml/inference.py",
    "ml/kneescope_ml/preprocess.py",
    "ml/kneescope_ml/types.py",
    "ml/kneescope_ml/render.py",
    *[str(p.relative_to(ROOT)) for p in (ROOT / "ml/kneescope_ml/adapters").glob("*.py")],
]


def imported_modules(path: Path) -> set[str]:
    tree = ast.parse(path.read_text())
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names |= {a.name for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
            names |= {f"{node.module}.{a.name}" for a in node.names}
    return names


def test_inference_side_never_imports_labels():
    for rel in INFERENCE_MODULES:
        mods = imported_modules(ROOT / rel)
        assert not any("labels" in m for m in mods), f"{rel} imports a labels module"


def test_prediction_functions_never_read_label_store():
    for fn in (service.fixture_prediction, service.model_prediction):
        assert "labels" not in inspect.getsource(fn), f"{fn.__name__} touches labels"
