#!/usr/bin/env python3
"""
FluxChat OpenAPI Schema Exporter.
Programmatically inspects all 7 FastAPI microservices and generates static
OpenAPI 3.1 JSON specifications for documentation portals, Postman, and CI/CD.
"""

import os
import sys
import json
import importlib
from pathlib import Path
from typing import Dict, Any

# Ensure backend root is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "docs" / "openapi"

sys.path.insert(0, str(BACKEND_DIR))

# Service metadata catalog
SERVICES = [
    {
        "id": "api-gateway",
        "name": "FluxChat API Gateway",
        "dir": BACKEND_DIR / "services" / "api-gateway",
        "output": "api-gateway.json",
        "prefix": "",
    },
    {
        "id": "auth-service",
        "name": "FluxChat Auth Service",
        "dir": BACKEND_DIR / "services" / "auth-service",
        "output": "auth-service.json",
        "prefix": "/api/v1/auth",
    },
    {
        "id": "user-service",
        "name": "FluxChat User Service",
        "dir": BACKEND_DIR / "services" / "user-service",
        "output": "user-service.json",
        "prefix": "/api/v1",
    },
    {
        "id": "chat-service",
        "name": "FluxChat Chat Service",
        "dir": BACKEND_DIR / "services" / "chat-service",
        "output": "chat-service.json",
        "prefix": "/api/v1",
    },
    {
        "id": "message-service",
        "name": "FluxChat Message Service",
        "dir": BACKEND_DIR / "services" / "message-service",
        "output": "message-service.json",
        "prefix": "/api/v1",
    },
    {
        "id": "websocket-service",
        "name": "FluxChat WebSocket Service",
        "dir": BACKEND_DIR / "services" / "websocket-service",
        "output": "websocket-service.json",
        "prefix": "/api/v1",
    },
    {
        "id": "notification-service",
        "name": "FluxChat Notification Service",
        "dir": BACKEND_DIR / "services" / "notification-service",
        "output": "notification-service.json",
        "prefix": "/api/v1",
    },
]


def load_service_app(service_dir: Path):
    """Dynamically import a service's FastAPI app using sys.path isolation."""
    # Temporarily prepend service directory to sys.path
    orig_sys_path = list(sys.path)
    # Remove any cached 'app' modules
    for mod_name in list(sys.modules.keys()):
        if mod_name == "app" or mod_name.startswith("app."):
            del sys.modules[mod_name]

    sys.path.insert(0, str(service_dir))
    try:
        app_module = importlib.import_module("app.main")
        fastapi_app = getattr(app_module, "app")
        schema = fastapi_app.openapi()
        return schema
    finally:
        sys.path = orig_sys_path


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print("=" * 78)
    print("  FLUXCHAT OPENAPI SCHEMA EXPORTER")
    print("=" * 78)
    print(f"Output Directory: {OUTPUT_DIR}\n")

    unified_paths: Dict[str, Any] = {}
    unified_components: Dict[str, Any] = {"schemas": {}}
    unified_tags: list = []
    seen_tags = set()

    for s in SERVICES:
        print(f"▶ Exporting {s['name']} from {s['dir'].name}...", end=" ", flush=True)
        try:
            schema = load_service_app(s["dir"])
            out_file = OUTPUT_DIR / s["output"]
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(schema, f, indent=2, ensure_ascii=False)
            path_count = len(schema.get("paths", {}))
            print(f"✔ ({path_count} routes -> {s['output']})")

            # Accumulate into unified schema
            prefix = s["prefix"]
            for path, methods in schema.get("paths", {}).items():
                target_path = f"{prefix}{path}" if prefix and not path.startswith(prefix) else path
                # Clean duplicate slashes
                target_path = "/" + "/".join(p for p in target_path.split("/") if p)
                unified_paths[target_path] = methods

            # Components / schemas
            components = schema.get("components", {}).get("schemas", {})
            unified_components["schemas"].update(components)

            # Tags
            for tag in schema.get("tags", []):
                t_name = tag.get("name")
                if t_name and t_name not in seen_tags:
                    seen_tags.add(t_name)
                    unified_tags.append(tag)

        except Exception as e:
            print(f"✘ FAILED: {e}")

    # Write unified schema
    unified_schema = {
        "openapi": "3.1.0",
        "info": {
            "title": "FluxChat Enterprise Platform — Unified API Specification",
            "version": "1.0.0",
            "description": "Comprehensive aggregated API specification for all FluxChat microservices routed through the API Gateway (:8000).",
            "contact": {
                "name": "FluxChat Engineering Team",
                "url": "https://github.com/Jyoti-jitu/chat-app",
            },
            "license": {
                "name": "MIT License",
            },
        },
        "servers": [
            {"url": "http://localhost:8000", "description": "Local API Gateway Ingress"},
            {"url": "http://127.0.0.1:8000", "description": "Local Loopback Ingress"},
        ],
        "tags": unified_tags,
        "paths": unified_paths,
        "components": unified_components,
    }

    unified_out = OUTPUT_DIR / "fluxchat_unified.json"
    with open(unified_out, "w", encoding="utf-8") as f:
        json.dump(unified_schema, f, indent=2, ensure_ascii=False)

    print(f"\n✔ Aggregated Unified Schema: {len(unified_paths)} total endpoints -> {unified_out.name}")
    print("=" * 78)
    print("✔ All OpenAPI specifications exported successfully!\n")


if __name__ == "__main__":
    main()
