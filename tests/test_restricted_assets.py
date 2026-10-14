"""KS-OPS-01: the repository guard blocks restricted assets."""

import importlib.util
import logging
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from kneescope_api.main import create_app

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("guard", ROOT / "scripts/check_restricted_assets.py")
assert spec and spec.loader
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


def make_repo(tmp_path: Path, files: dict[str, bytes]) -> Path:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    for rel, content in files.items():
        path = tmp_path / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    subprocess.run(["git", "add", "-f", "."], cwd=tmp_path, check=True)
    return tmp_path


def test_guard_blocks_dicom_large_file_and_artifacts(tmp_path):
    repo = make_repo(
        tmp_path,
        {
            "scan/slice.dcm": b"DICM",
            "big.bin": b"0" * (guard.MAX_BYTES + 1),
            "artifacts/runs/metrics.json": b"{}",
            "model.ckpt": b"x",
            "README.md": b"ok",
            "data/.gitkeep": b"",
        },
    )
    problems = guard.violations(repo, guard.tracked_files(repo))
    joined = "\n".join(problems)
    assert "scan/slice.dcm" in joined
    assert "big.bin" in joined
    assert "artifacts/runs/metrics.json" in joined
    assert "model.ckpt" in joined
    assert "README.md" not in joined and "data/.gitkeep" not in joined


def test_repository_is_clean():
    assert guard.violations(ROOT, guard.tracked_files(ROOT)) == []


@pytest.mark.parametrize("study_id", ["fx-study-003", "does-not-exist"])
def test_failure_logs_do_not_leak_paths_or_bodies(caplog, study_id):
    client = TestClient(create_app())
    secret = "PATIENT REPORT TEXT"
    with caplog.at_level(logging.DEBUG):
        client.post("/predictions", json={"study_id": study_id, "note": secret})
        client.post("/predictions", json={"study_id": study_id})
    text = caplog.text + "".join(str(r.args) for r in caplog.records)
    assert secret not in text
    assert str(ROOT) not in text
