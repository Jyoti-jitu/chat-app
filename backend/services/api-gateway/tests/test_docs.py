"""
Tests for API Gateway documentation aggregator.
"""

import pytest
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_docs_unknown_service():
    """Verify 404 response for non-existent service documentation."""
    resp = client.get("/api/v1/docs/non-existent-service/openapi.json")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_docs_swagger_ui_endpoint():
    """Verify Swagger UI renders cleanly with 200."""
    resp = client.get("/docs")
    assert resp.status_code == 200
    assert "swagger-ui" in resp.text.lower() or "swagger" in resp.text.lower()


def test_docs_redoc_endpoint():
    """Verify ReDoc UI renders cleanly with 200."""
    resp = client.get("/redoc")
    assert resp.status_code == 200
    assert "redoc" in resp.text.lower()
