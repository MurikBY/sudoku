import ast
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1] / "app"

# Each layer may import only these other layers. The sudoku engine is the bottom:
# models use its enums, schemas describe its steps, services drive it.
ALLOWED_LAYERS = {
    "engine": set(),
    "models": {"engine"},
    "schemas": {"engine", "models"},
    "services": {"background", "config", "db", "engine", "models", "schemas"},
    "api": {"config", "db", "engine", "models", "schemas", "services"},
    "bot": {"background", "config", "db", "models", "services"},
}


def _layer(module: str) -> str:
    parts = module.split(".")
    if parts[:3] == ["app", "services", "sudoku"]:
        return "engine"
    return parts[1]


def _app_imports(path: Path) -> set[str]:
    imported: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("app."):
            imported.add(node.module)
        elif isinstance(node, ast.Import):
            imported.update(alias.name for alias in node.names if alias.name.startswith("app."))
    return imported


def _layer_violations() -> list[str]:
    violations: list[str] = []
    for path in sorted(APP.rglob("*.py")):
        module = ".".join(path.relative_to(APP.parent).with_suffix("").parts)
        source_layer = _layer(module)
        allowed = ALLOWED_LAYERS.get(source_layer)
        if allowed is None:
            continue
        for imported in sorted(_app_imports(path)):
            target_layer = _layer(imported)
            if target_layer != source_layer and target_layer not in allowed:
                violations.append(f"{module} ({source_layer}) imports {imported} ({target_layer})")
    return violations


def test_layers_import_only_downward() -> None:
    assert _layer_violations() == []


@pytest.mark.parametrize(
    ("module", "layer"),
    [
        ("app.services.sudoku.grid", "engine"),
        ("app.services.games.moves", "services"),
        ("app.api.mappers", "api"),
    ],
)
def test_layer_of_a_module(module: str, layer: str) -> None:
    assert _layer(module) == layer
