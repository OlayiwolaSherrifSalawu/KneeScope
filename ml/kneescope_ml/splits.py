"""Grouped, stratified, deterministic study splits (KS-DATA-08).

- The unit of assignment is a **group** (patient when identifiers exist, otherwise the
  study). A group never spans partitions, so no study or patient leaks.
- Groups are placed greedily, rarest findings first, into the partition whose positive
  counts are furthest below target, with a seeded tie-break: stratified where feasible,
  identical for the same inputs and seed.
- Labels are read only to count positives for stratification. ``unknown`` and
  ``not_labeled`` never count as negative.
- ``test_fraction = 0`` gives a validation-only design; results must then be reported as
  validation results (AGENTS.md section 16).
"""

from __future__ import annotations

import hashlib
import random
from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

PARTITIONS = ("train", "validation", "test")


class LeakageError(ValueError):
    """A study or group appears in more than one partition."""


@dataclass(frozen=True)
class SplitResult:
    assignment: dict[str, str]  # study_id -> partition
    split_hash: str
    seed: int
    grouping: str


def split_hash(assignment: Mapping[str, str]) -> str:
    text = "\n".join(f"{s},{p}" for s, p in sorted(assignment.items()))
    return hashlib.sha256(text.encode()).hexdigest()


def make_splits(
    groups: Mapping[str, str],
    labels: Mapping[str, Mapping[str, str]],
    findings: Sequence[str],
    *,
    seed: int,
    fractions: tuple[float, float, float] = (0.7, 0.15, 0.15),
    grouping: str = "patient",
) -> SplitResult:
    """``groups``: study_id -> group id. ``labels``: study_id -> {finding: state}."""
    if abs(sum(fractions) - 1.0) > 1e-9 or any(f < 0 for f in fractions):
        raise ValueError("fractions must be non-negative and sum to 1")
    members: dict[str, list[str]] = defaultdict(list)
    for study, group in groups.items():
        members[group].append(study)

    def positives(group: str) -> Counter[str]:
        c: Counter[str] = Counter()
        for study in members[group]:
            for f in findings:
                if labels.get(study, {}).get(f) == "positive":
                    c[f] += 1
        return c

    totals: Counter[str] = Counter()
    for g in members:
        totals.update(positives(g))
    n_studies = len(groups)
    rng = random.Random(seed)
    order = sorted(members)
    rng.shuffle(order)
    # Rarest-finding groups first so scarce positives are spread before common ones.
    rarity = {f: 1.0 / totals[f] for f in findings if totals[f]}
    order.sort(key=lambda g: -sum(rarity.get(f, 0.0) * n for f, n in positives(g).items()))

    placed_studies: Counter[str] = Counter()
    placed_pos: dict[str, Counter[str]] = {p: Counter() for p in PARTITIONS}
    assignment: dict[str, str] = {}
    active = [p for p, frac in zip(PARTITIONS, fractions, strict=True) if frac > 0]
    target = dict(zip(PARTITIONS, fractions, strict=True))
    for g in order:
        pos = positives(g)

        def deficit(p: str, pos: Counter[str] = pos) -> tuple[float, float, float]:
            size_gap = target[p] * n_studies - placed_studies[p]
            pos_gap = sum(target[p] * totals[f] - placed_pos[p][f] for f in pos)
            return (pos_gap if pos else 0.0, size_gap, rng.random())

        best = max(active, key=deficit)
        for study in members[g]:
            assignment[study] = best
        placed_studies[best] += len(members[g])
        placed_pos[best].update(pos)
    check_no_leakage(assignment, groups)
    return SplitResult(assignment=assignment, split_hash=split_hash(assignment), seed=seed, grouping=grouping)


def check_no_leakage(assignment: Mapping[str, str], groups: Mapping[str, str]) -> None:
    """Raise if any group's studies fall in more than one partition."""
    seen: dict[str, set[str]] = defaultdict(set)
    for study, part in assignment.items():
        if part not in PARTITIONS:
            raise ValueError(f"unknown partition {part!r}")
        seen[groups[study]].add(part)
    leaking = sorted(g for g, parts in seen.items() if len(parts) > 1)
    if leaking:
        raise LeakageError(f"{len(leaking)} group(s) span more than one partition")


def partition_counts(
    assignment: Mapping[str, str], labels: Mapping[str, Mapping[str, str]], findings: Sequence[str]
) -> dict[str, dict[str, dict[str, int]]]:
    """partition -> finding -> {positive, negative, unknown, studies}."""
    out: dict[str, dict[str, dict[str, int]]] = {}
    for part in PARTITIONS:
        studies = [s for s, p in assignment.items() if p == part]
        out[part] = {}
        for f in findings:
            c = Counter(labels.get(s, {}).get(f, "not_labeled") for s in studies)
            out[part][f] = {
                "positive": c["positive"],
                "negative": c["negative"],
                "unknown": c["unknown"] + c["not_labeled"],
                "studies": len(studies),
            }
    return out
