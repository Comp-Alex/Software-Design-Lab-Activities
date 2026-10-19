#!/usr/bin/env python3
"""Refresh the dashboard's repository activity snapshot from local Git history."""

from __future__ import annotations

import json
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "dashboard" / "data" / "project.json"
EXCLUDED_DIRS = {".git", ".github", "__pycache__"}
UML_EXTENSIONS = {".drawio", ".puml", ".plantuml", ".uml", ".vsdx"}


def git(*args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(ROOT), *args],
        text=True,
        encoding="utf-8",
        errors="replace",
    ).strip()


def tracked_files() -> list[Path]:
    paths = git("ls-files", "-z").split("\0")
    return [
        ROOT / path
        for path in paths
        if path
        and (ROOT / path).is_file()
        and not set(Path(path).parts).intersection(EXCLUDED_DIRS)
    ]


def recent_commits(now: datetime) -> tuple[int, list[dict[str, str]]]:
    records = git(
        "log",
        "-10",
        "--date=iso-strict",
        "--pretty=format:%h%x1f%s%x1f%cI",
    )
    commits = []
    weekly_count = 0
    cutoff = now - timedelta(days=7)
    for record in records.splitlines():
        short_hash, subject, timestamp = record.split("\x1f", maxsplit=2)
        commit_date = datetime.fromisoformat(timestamp)
        if commit_date >= cutoff:
            weekly_count += 1
        commits.append(
            {
                "hash": short_hash,
                "message": subject,
                "date": commit_date.strftime("%b %d, %Y"),
                "timestamp": timestamp,
            }
        )
    return weekly_count, commits[:5]


def main() -> None:
    now = datetime.now(UTC)
    files = tracked_files()
    weekly_count, commits = recent_commits(now)
    snapshot = {
        "generatedAt": now.isoformat(timespec="seconds"),
        "repository": {
            "trackedFiles": len(files),
            "umlAssets": sum(path.suffix.lower() in UML_EXTENSIONS for path in files),
        },
        "activity": {
            "commitsLast7Days": weekly_count,
            "recentCommits": commits,
        },
    }
    OUTPUT.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(
        "Updated dashboard snapshot: "
        f"{len(files)} tracked files, {weekly_count} commits in the last 7 days."
    )


if __name__ == "__main__":
    main()
