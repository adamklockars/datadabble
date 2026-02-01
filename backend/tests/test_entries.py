"""Tests for entry endpoints."""
import pytest


class TestListEntries:
    """Tests for listing entries."""

    def test_list_empty(self, client, auth_headers, database):
        """Test listing entries when none exist."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/entries",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["entries"] == []
        assert data["pagination"]["total"] == 0

    def test_list_entries(self, client, auth_headers, database, entry):
        """Test listing entries."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/entries",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["entries"]) == 1
        assert data["pagination"]["total"] == 1

    def test_list_pagination(self, client, auth_headers, database):
        """Test entry pagination."""
        from app.models import Entry

        # Create 25 entries
        for i in range(25):
            Entry(database=database, values={"index": i}).save()

        # Get first page
        response = client.get(
            f"/api/v1/databases/{database.slug}/entries?page=1&per_page=10",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["entries"]) == 10
        assert data["pagination"]["total"] == 25
        assert data["pagination"]["pages"] == 3

    def test_list_database_not_found(self, client, auth_headers):
        """Test listing entries for nonexistent database."""
        response = client.get(
            "/api/v1/databases/nonexistent/entries",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestCreateEntry:
    """Tests for creating entries."""

    def test_create_success(self, client, auth_headers, database):
        """Test successful entry creation."""
        response = client.post(
            f"/api/v1/databases/{database.slug}/entries",
            headers=auth_headers,
            json={
                "values": {"name": "Test", "count": 42},
            },
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["entry"]["values"]["name"] == "Test"
        assert data["entry"]["values"]["count"] == 42

    def test_create_missing_values(self, client, auth_headers, database):
        """Test creating entry without values."""
        response = client.post(
            f"/api/v1/databases/{database.slug}/entries",
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 400


class TestGetEntry:
    """Tests for getting a specific entry."""

    def test_get_success(self, client, auth_headers, database, entry):
        """Test getting an entry."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/entries/{entry.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["values"]["test_field"] == "test_value"

    def test_get_not_found(self, client, auth_headers, database):
        """Test getting nonexistent entry."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/entries/000000000000000000000000",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestUpdateEntry:
    """Tests for updating entries."""

    def test_update_success(self, client, auth_headers, database, entry):
        """Test successful entry update."""
        response = client.put(
            f"/api/v1/databases/{database.slug}/entries/{entry.id}",
            headers=auth_headers,
            json={
                "values": {"test_field": "updated_value", "new_field": 123},
            },
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["entry"]["values"]["test_field"] == "updated_value"
        assert data["entry"]["values"]["new_field"] == 123


class TestDeleteEntry:
    """Tests for deleting entries."""

    def test_delete_success(self, client, auth_headers, database, entry):
        """Test successful entry deletion."""
        response = client.delete(
            f"/api/v1/databases/{database.slug}/entries/{entry.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify deletion
        response = client.get(
            f"/api/v1/databases/{database.slug}/entries/{entry.id}",
            headers=auth_headers,
        )
        assert response.status_code == 404
