"""Publish the local backlog to GitHub issues — idempotently.

Nothing has been published yet: the KneeScope repository has no GitHub remote. Run this
only after the coordinator approves publishing to a specific existing repository.

  python scripts/backlog.py render
  python scripts/publish_issues.py --repo OWNER/NAME --dry-run     # show the plan
  python scripts/publish_issues.py --repo OWNER/NAME               # create/update
  python scripts/publish_issues.py --repo OWNER/NAME --native-links # also try GitHub
                                                                  # sub-issues + blocked-by

Idempotency: an existing issue is matched by the `KS-…:` prefix of its title or the
`<!-- KS-… -->` marker in its body (open or closed). Matches are updated, never duplicated.
The script never creates repositories, changes visibility, or closes issues.
Results are written to docs/issues/published.json.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ISSUES = ROOT / "docs" / "issues"
ID_RE = re.compile(r"\b(KS-[A-Z]+-[A-Z0-9]+)\b")

LABELS = {
    "priority:P0": ("b60205", "Required for delivery"),
    "priority:P1": ("d93f0b", "Should ship"),
    "priority:P2": ("fbca04", "Optional or conditional"),
    "type:epic": ("5319e7", "Grouping issue"),
    "type:task": ("1d76db", "Actionable task"),
    "type:decision": ("0e8a16", "Human decision with recorded evidence"),
    "type:conditional": ("c5def5", "Only if its trigger is recorded"),
    "type:optional": ("ededed", "Enhancement after the core"),
    "status:ready": ("0e8a16", "All prerequisites closed"),
    "status:blocked": ("e4e669", "Waiting on prerequisites"),
}
WORKSTREAMS = [
    "coordination",
    "data",
    "labels",
    "modelling",
    "evaluation",
    "backend",
    "frontend",
    "operations",
    "qa",
    "delivery",
]


def gh(*args: str, input_text: str | None = None) -> str:
    result = subprocess.run(["gh", *args], input=input_text, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args[:3])} failed: {result.stderr.strip()}")
    return result.stdout


def existing_issues(repo: str) -> dict[str, dict[str, Any]]:
    raw = gh(
        "issue",
        "list",
        "--repo",
        repo,
        "--state",
        "all",
        "--limit",
        "1000",
        "--json",
        "number,title,body,url",
    )
    found: dict[str, dict[str, Any]] = {}
    for issue in json.loads(raw):
        m = re.match(r"^(KS-[A-Z]+-[A-Z0-9]+):", issue["title"]) or re.search(
            r"<!-- (KS-[A-Z]+-[A-Z0-9]+) ", issue["body"] or ""
        )
        if m:
            found[m.group(1)] = issue
    return found


def body_for(item_id: str, numbers: dict[str, int], preamble: str = "") -> str:
    text = (ISSUES / f"{item_id}.md").read_text(encoding="utf-8")
    if preamble:
        marker_end = text.index("-->") + 3  # keep the ID marker first for idempotent matching
        text = f"{text[:marker_end]}\n\n> {preamble}\n{text[marker_end:]}"
    # Turn backtick IDs into "KS-… (#n)" once the referenced issue exists.
    return re.sub(
        r"`(KS-[A-Z]+-[A-Z0-9]+)`",
        lambda m: f"`{m.group(1)}` (#{numbers[m.group(1)]})" if m.group(1) in numbers else f"`{m.group(1)}`",
        text,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True, help="Existing OWNER/NAME repository")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--native-links",
        action="store_true",
        help="Also create GitHub sub-issue and blocked-by links (best effort)",
    )
    ap.add_argument("--preamble", default="", help="Note shown at the top of every issue body")
    args = ap.parse_args()

    manifest = json.loads((ISSUES / "manifest.json").read_text(encoding="utf-8"))
    gh("repo", "view", args.repo, "--json", "name")  # fails if missing or inaccessible
    existing = existing_issues(args.repo)
    items = [{"id": e["id"], "title": e["title"], "labels": ["type:epic"]} for e in manifest["epics"]]
    for i in manifest["issues"]:
        status = "status:ready" if i["status"] in {"ready", "optional-ready"} else "status:blocked"
        items.append(
            {
                "id": i["id"],
                "title": i["title"],
                "epic": i["epic"],
                "depends_on": i["depends_on"],
                "labels": [
                    f"priority:{i['priority']}",
                    f"type:{i['type']}",
                    f"workstream:{i['workstream']}",
                    status,
                ],
            }
        )

    plan = [(it["id"], "update" if it["id"] in existing else "create") for it in items]
    print(f"{sum(a == 'create' for _, a in plan)} to create, {sum(a == 'update' for _, a in plan)} to update")
    if args.dry_run:
        for iid, action in plan:
            print(f"  {action:<6} {iid}")
        return 0

    for name, (color, desc) in LABELS.items():
        gh("label", "create", name, "--repo", args.repo, "--color", color, "--description", desc, "--force")
    for ws in WORKSTREAMS:
        gh("label", "create", f"workstream:{ws}", "--repo", args.repo, "--color", "bfd4f2", "--force")

    numbers = {k: v["number"] for k, v in existing.items()}
    published: dict[str, dict[str, Any]] = {}
    # Two passes: create/update all (so numbers exist), then rewrite bodies with #links.
    for pass_no in (1, 2):
        for it in items:
            title = f"{it['id']}: {it['title'].removeprefix('Epic: ')}"
            body = body_for(it["id"], numbers, args.preamble)
            label_args = [x for lbl in it["labels"] for x in ("--label", lbl)]
            if it["id"] in numbers:
                if pass_no == 2 or it["id"] in existing:
                    # `gh issue edit` adds labels; drop the opposite status label explicitly.
                    stale = {"status:ready", "status:blocked"} - set(it["labels"])
                    label_args = [x for lbl in it["labels"] for x in ("--add-label", lbl)]
                    if stale and any(lbl.startswith("status:") for lbl in it["labels"]):
                        label_args += ["--remove-label", stale.pop()]
                    gh(
                        "issue",
                        "edit",
                        str(numbers[it["id"]]),
                        "--repo",
                        args.repo,
                        "--title",
                        title,
                        "--body-file",
                        "-",
                        *label_args,
                        input_text=body,
                    )
            else:
                url = gh(
                    "issue",
                    "create",
                    "--repo",
                    args.repo,
                    "--title",
                    title,
                    "--body-file",
                    "-",
                    *label_args,
                    input_text=body,
                ).strip()
                numbers[it["id"]] = int(url.rsplit("/", 1)[1])
                time.sleep(1.5)  # stay under GitHub content-creation rate limits
            published[it["id"]] = {
                "number": numbers[it["id"]],
                "url": f"https://github.com/{args.repo}/issues/{numbers[it['id']]}",
            }

    if args.native_links:
        db_ids = {k: json.loads(gh("api", f"repos/{args.repo}/issues/{n}"))["id"] for k, n in numbers.items()}
        for it in items:
            n = numbers[it["id"]]
            for link, target in [("sub_issues", it["epic"])] if it.get("epic") else []:
                try:
                    gh(
                        "api",
                        "-X",
                        "POST",
                        f"repos/{args.repo}/issues/{numbers[target]}/{link}",
                        "-F",
                        f"sub_issue_id={db_ids[it['id']]}",
                    )
                except RuntimeError as exc:
                    print(f"  sub-issue link {it['id']} -> {target} skipped: {exc}")
            for dep in it.get("depends_on", []):
                try:
                    gh(
                        "api",
                        "-X",
                        "POST",
                        f"repos/{args.repo}/issues/{n}/dependencies/blocked_by",
                        "-F",
                        f"issue_id={db_ids[dep]}",
                    )
                except RuntimeError as exc:
                    print(f"  blocked-by {it['id']} <- {dep} skipped (body links remain): {exc}")

    out = ISSUES / "published.json"
    out.write_text(json.dumps({"repo": args.repo, "issues": published}, indent=2) + "\n", encoding="utf-8")
    print(f"published {len(published)} items; mapping written to {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
