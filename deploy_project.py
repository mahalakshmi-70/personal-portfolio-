"""Backward-compatible entry point for deploy.py."""

from pathlib import Path
import runpy


runpy.run_path(str(Path(__file__).resolve().with_name("deploy.py")), run_name="__main__")
