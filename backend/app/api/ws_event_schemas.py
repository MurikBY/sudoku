from typing import Any

from fastapi import FastAPI
from pydantic import TypeAdapter

from app.schemas.party import PartyWsEvent

# FastAPI leaves WebSocket payloads out of the document. These names are the contract.
_EVENT_MODELS = (
    ("PartyMembersEvent", "members"),
    ("PartyStartedEvent", "started"),
    ("PartyCancelledEvent", "cancelled"),
)
_REF_PREFIX = "#/components/schemas/"


def install_party_ws_event_schemas(app: FastAPI) -> None:
    original_openapi = app.openapi

    def openapi() -> dict[str, Any]:
        schema = original_openapi()
        _add_party_ws_event_schemas(schema)
        return schema

    app.openapi = openapi  # type: ignore[method-assign]  # FastAPI replaces this method


def _add_party_ws_event_schemas(schema: dict[str, Any]) -> None:
    components = _schema_components(schema)
    generated = _party_ws_event_components()
    _require_refs_resolve(generated, set(components) | set(generated))
    components.update(generated)


def _schema_components(schema: dict[str, Any]) -> dict[str, Any]:
    try:
        components = schema["components"]["schemas"]
    except KeyError as missing:
        raise ValueError("OpenAPI document is missing components.schemas") from missing
    if not isinstance(components, dict):
        raise ValueError("OpenAPI components.schemas must be an object")
    return components


def _party_ws_event_components() -> dict[str, Any]:
    union_schema = TypeAdapter(PartyWsEvent).json_schema(
        ref_template=f"{_REF_PREFIX}{{model}}",
        mode="serialization",
    )
    # Nested models already have components. Copying their $defs would replace those schemas.
    definitions = union_schema.pop("$defs", None)
    if not isinstance(definitions, dict):
        raise ValueError("party websocket event schema is missing $defs")
    components = {
        name: _event_model_schema(name, literal, definitions) for name, literal in _EVENT_MODELS
    }
    _require_union(union_schema)
    union_schema["title"] = "PartyWsEvent"
    components["PartyWsEvent"] = union_schema
    return components


def _event_model_schema(name: str, literal: str, definitions: dict[str, Any]) -> dict[str, Any]:
    model_schema = definitions.get(name)
    if not isinstance(model_schema, dict):
        raise ValueError(f"party websocket event schema is missing {name}")
    _require_type_literal(name, model_schema, literal)
    return model_schema


def _require_type_literal(name: str, model_schema: dict[str, Any], literal: str) -> None:
    properties = model_schema.get("properties")
    if not isinstance(properties, dict):
        raise ValueError(f"{name} schema is missing properties")
    type_schema = properties.get("type")
    if not isinstance(type_schema, dict) or type_schema.get("const") != literal:
        raise ValueError(f"{name} schema must use the literal type {literal}")


def _require_union(schema: dict[str, Any]) -> None:
    expected = [f"{_REF_PREFIX}{name}" for name, _literal in _EVENT_MODELS]
    one_of = schema.get("oneOf")
    if not isinstance(one_of, list):
        raise ValueError("PartyWsEvent schema must be a oneOf")
    refs = [item.get("$ref") if isinstance(item, dict) else None for item in one_of]
    if refs != expected:
        raise ValueError("PartyWsEvent oneOf must reference the three event schemas")
    discriminator = schema.get("discriminator")
    if not isinstance(discriminator, dict) or discriminator.get("propertyName") != "type":
        raise ValueError("PartyWsEvent schema must discriminate on type")
    mapping = discriminator.get("mapping")
    expected_mapping = {literal: f"{_REF_PREFIX}{name}" for name, literal in _EVENT_MODELS}
    if mapping != expected_mapping:
        raise ValueError("PartyWsEvent discriminator mapping does not match the event types")


def _require_refs_resolve(generated: dict[str, Any], available: set[str]) -> None:
    for name, model_schema in generated.items():
        for ref in _schema_refs(model_schema):
            if not ref.startswith(_REF_PREFIX):
                raise ValueError(f"{name} has an unexpected ref {ref}")
            target = ref.removeprefix(_REF_PREFIX)
            if target not in available:
                raise ValueError(f"{name} references missing schema {target}")


def _schema_refs(value: object) -> list[str]:
    if isinstance(value, dict):
        refs = _nested_refs(list(value.values()))
        ref = value.get("$ref")
        if isinstance(ref, str):
            refs.append(ref)
        return refs
    if isinstance(value, list):
        return _nested_refs(value)
    return []


def _nested_refs(items: list[object]) -> list[str]:
    refs: list[str] = []
    for item in items:
        refs.extend(_schema_refs(item))
    return refs
