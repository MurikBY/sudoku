#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.main import app

_OPENAPI_PATH = Path(__file__).resolve().parents[2] / "frontend" / "src" / "api" / "openapi.json"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    text = _openapi_text()
    if args.check:
        _require_matches(text)
        return
    _OPENAPI_PATH.write_text(text)


def _openapi_text() -> str:
    return json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"


def _require_matches(text: str) -> None:
    if not _OPENAPI_PATH.is_file():
        raise SystemExit(f"missing OpenAPI document: {_OPENAPI_PATH}")
    current = _OPENAPI_PATH.read_text()
    if current != text:
        raise SystemExit(f"OpenAPI document is out of date: {_OPENAPI_PATH}")


if __name__ == "__main__":
    main()
