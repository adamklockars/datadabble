"""Tests for database endpoints."""
import pytest


class TestListDatabases:
    """Tests for listing databases."""

    def test_list_empty(self, client, auth_headers):
        """Test listing databases when none exist."""
        response = client.get("/api/v1/databases", headers=auth_headers)
        assert response.status_code == 200
        assert response.get_json() == []

    def test_list_databases(self, client, auth_headers, database):
        """Test listing databases."""
        response = client.get("/api/v1/databases", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert len(data) == 1
        assert data[0]["title"] == "Test Database"

    def test_list_unauthorized(self, client):
        """Test listing databases without auth."""
        response = client.get("/api/v1/databases")
        assert response.status_code == 401


class TestCreateDatabase:
    """Tests for creating databases."""

    def test_create_success(self, client, auth_headers):
        """Test successful database creation."""
        response = client.post(
            "/api/v1/databases",
            headers=auth_headers,
            json={
                "title": "My New Database",
                "description": "A description",
            },
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["database"]["title"] == "My New Database"
        assert data["database"]["slug"] == "my-new-database"

    def test_create_duplicate(self, client, auth_headers, database):
        """Test creating database with duplicate title."""
        response = client.post(
            "/api/v1/databases",
            headers=auth_headers,
            json={"title": "Test Database"},
        )
        assert response.status_code == 409

    def test_create_missing_title(self, client, auth_headers):
        """Test creating database without title."""
        response = client.post(
            "/api/v1/databases",
            headers=auth_headers,
            json={"description": "Just a description"},
        )
        assert response.status_code == 400


class TestGetDatabase:
    """Tests for getting a specific database."""

    def test_get_success(self, client, auth_headers, database):
        """Test getting a database."""
        response = client.get(
            f"/api/v1/databases/{database.slug}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["title"] == "Test Database"

    def test_get_not_found(self, client, auth_headers):
        """Test getting nonexistent database."""
        response = client.get(
            "/api/v1/databases/nonexistent",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestUpdateDatabase:
    """Tests for updating databases."""

    def test_update_success(self, client, auth_headers, database):
        """Test successful database update."""
        response = client.put(
            f"/api/v1/databases/{database.slug}",
            headers=auth_headers,
            json={
                "title": "Updated Title",
                "description": "Updated description",
            },
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["database"]["title"] == "Updated Title"
        assert data["database"]["slug"] == "updated-title"

    def test_update_not_found(self, client, auth_headers):
        """Test updating nonexistent database."""
        response = client.put(
            "/api/v1/databases/nonexistent",
            headers=auth_headers,
            json={"title": "New Title"},
        )
        assert response.status_code == 404


class TestDeleteDatabase:
    """Tests for deleting databases."""

    def test_delete_success(self, client, auth_headers, database):
        """Test successful database deletion."""
        response = client.delete(
            f"/api/v1/databases/{database.slug}",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify deletion
        response = client.get(
            f"/api/v1/databases/{database.slug}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_not_found(self, client, auth_headers):
        """Test deleting nonexistent database."""
        response = client.delete(
            "/api/v1/databases/nonexistent",
            headers=auth_headers,
        )
        assert response.status_code == 404
