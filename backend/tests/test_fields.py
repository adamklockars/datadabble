"""Tests for field endpoints."""
import pytest


class TestListFields:
    """Tests for listing fields."""

    def test_list_empty(self, client, auth_headers, database):
        """Test listing fields when none exist."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/fields",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.get_json() == []

    def test_list_fields(self, client, auth_headers, database, field):
        """Test listing fields."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/fields",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert len(data) == 1
        assert data[0]["name"] == "test_field"

    def test_list_database_not_found(self, client, auth_headers):
        """Test listing fields for nonexistent database."""
        response = client.get(
            "/api/v1/databases/nonexistent/fields",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestCreateField:
    """Tests for creating fields."""

    def test_create_success(self, client, auth_headers, database):
        """Test successful field creation."""
        response = client.post(
            f"/api/v1/databases/{database.slug}/fields",
            headers=auth_headers,
            json={
                "name": "new_field",
                "field_type": "INT",
                "required": True,
            },
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["field"]["name"] == "new_field"
        assert data["field"]["field_type"] == "INT"

    def test_create_duplicate(self, client, auth_headers, database, field):
        """Test creating field with duplicate name."""
        response = client.post(
            f"/api/v1/databases/{database.slug}/fields",
            headers=auth_headers,
            json={
                "name": "test_field",
                "field_type": "STR",
            },
        )
        assert response.status_code == 409

    def test_create_invalid_type(self, client, auth_headers, database):
        """Test creating field with invalid type."""
        response = client.post(
            f"/api/v1/databases/{database.slug}/fields",
            headers=auth_headers,
            json={
                "name": "invalid_field",
                "field_type": "INVALID",
            },
        )
        assert response.status_code == 400


class TestGetField:
    """Tests for getting a specific field."""

    def test_get_success(self, client, auth_headers, database, field):
        """Test getting a field."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/fields/{field.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["name"] == "test_field"

    def test_get_not_found(self, client, auth_headers, database):
        """Test getting nonexistent field."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/fields/000000000000000000000000",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestUpdateField:
    """Tests for updating fields."""

    def test_update_success(self, client, auth_headers, database, field):
        """Test successful field update."""
        response = client.put(
            f"/api/v1/databases/{database.slug}/fields/{field.id}",
            headers=auth_headers,
            json={
                "name": "updated_field",
                "required": False,
            },
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["field"]["name"] == "updated_field"


class TestDeleteField:
    """Tests for deleting fields."""

    def test_delete_success(self, client, auth_headers, database, field):
        """Test successful field deletion."""
        response = client.delete(
            f"/api/v1/databases/{database.slug}/fields/{field.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify deletion
        response = client.get(
            f"/api/v1/databases/{database.slug}/fields/{field.id}",
            headers=auth_headers,
        )
        assert response.status_code == 404
