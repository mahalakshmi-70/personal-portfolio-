#!/usr/bin/env python3
"""Commit and push this project to GitHub using its existing remote."""

from pathlib import Path
import subprocess
import sys


PROJECT_DIR = Path(__file__).resolve().parent


def run_git(*args, check=True):
    return subprocess.run(
        ["git", *args], cwd=PROJECT_DIR, check=check, text=True
    )


def main():
    if not (PROJECT_DIR / ".git").exists():
        print("Initializing a Git repository in", PROJECT_DIR)
        run_git("init", "-b", "main")

    remote = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    if remote.returncode:
        print("No origin remote is configured. Add one with:")
        print('  git remote add origin "https://github.com/USER/REPOSITORY.git"')
        return 1

    run_git("add", "-A")
    staged = subprocess.run(
        ["git", "diff", "--cached", "--quiet"], cwd=PROJECT_DIR
    )
    if staged.returncode == 0:
        print("No changes to commit.")
        return 0

    message = input("Commit message [Update portfolio]: ").strip() or "Update portfolio"
    run_git("commit", "-m", message)
    run_git("push", "-u", "origin", "HEAD")
    print("Source pushed to", remote.stdout.strip())
    print(
        "The Flask app requires a Python capable host. GitHub Pages can host only "
        "the static frontend, not the contact or admin API."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, subprocess.CalledProcessError) as error:
        print(f"Deployment helper failed: {error}", file=sys.stderr)
        raise SystemExit(1)
