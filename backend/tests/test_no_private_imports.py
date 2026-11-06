import ast
from pathlib import Path

import pytest

_ROOTS = ("app", "scripts", "tests")


def test_modules_do_not_import_private_names() -> None:
    backend = Path(__file__).resolve().parents[1]
    failures: list[str] = []
    for root_name in _ROOTS:
        for path in sorted((backend / root_name).rglob("*.py")):
            failures.extend(_private_imports(path, backend))
    if failures:
        pytest.fail("\n".join(failures))


def _private_imports(path: Path, backend: Path) -> list[str]:
    tree = ast.parse(path.read_text(), filename=str(path))
    found: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom):
            continue
        module = node.module
        if module is None or not (module == "app" or module.startswith("app.")):
            continue
        for alias in node.names:
            if alias.name.startswith("_"):
                relative = path.relative_to(backend)
                found.append(f"{relative}:{node.lineno} imports {alias.name} from {module}")
    return found
