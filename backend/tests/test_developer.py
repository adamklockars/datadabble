"""Tests for developer API endpoints (/api/v1/developer)."""
import pytest
from app.models import OAuthClient, OAuthToken


class TestListScopes:
    """Tests for GET /api/v1/developer/scopes."""

    def test_list_all_scopes(self, client, auth_headers, account):
        """Verify all 9 OAuth scopes are returned."""
        response = client.get("/api/v1/developer/scopes", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert "scopes" in data
        assert len(data["scopes"]) == 9
        scope_names = {s["name"] for s in data["scopes"]}
        expected = {
            "read:user", "read:databases", "write:databases",
            "read:fields", "write:fields", "read:entries",
            "write:entries", "read:visualizations", "write:visualizations",
        }
        assert scope_names == expected
        # Each scope should have a description
        for scope in data["scopes"]:
            assert "name" in scope
            assert "description" in scope
            assert len(scope["description"]) > 0


class TestListClients:
    """Tests for GET /api/v1/developer/clients."""

    def test_list_clients_empty(self, client, auth_headers, account):
        """Listing clients when none exist returns empty list."""
        response = client.get("/api/v1/developer/clients", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["clients"] == []
        assert data["total"] == 0

    def test_list_clients_with_client(self, client, auth_headers, account, oauth_client):
        """Listing clients returns the user's registered OAuth clients."""
        response = client.get("/api/v1/developer/clients", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["total"] == 1
        assert data["clients"][0]["client_id"] == oauth_client.client_id
        assert data["clients"][0]["name"] == "Test OAuth App"


class TestCreateClient:
    """Tests for POST /api/v1/developer/clients."""

    def test_create_client_success(self, client, auth_headers, account):
        """Creating a client returns client_secret exactly once."""
        payload = {
            "name": "My New App",
            "description": "An integration app",
            "redirect_uris": ["http://localhost:8080/callback"],
            "scopes": ["read:user", "read:databases"],
        }
        response = client.post(
            "/api/v1/developer/clients", json=payload, headers=auth_headers
        )
        assert response.status_code == 201
        data = response.get_json()
        assert "client" in data
        assert "client_secret" in data["client"]
        assert len(data["client"]["client_secret"]) > 0
        assert data["client"]["name"] == "My New App"
        assert data["client"]["scopes"] == ["read:user", "read:databases"]

        # Verify subsequent GET does NOT return the secret
        created_client_id = data["client"]["client_id"]
        get_resp = client.get(
            f"/api/v1/developer/clients/{created_client_id}", headers=auth_headers
        )
        assert get_resp.status_code == 200
        assert "client_secret" not in get_resp.get_json()

    def test_create_client_missing_name(self, client, auth_headers, account):
        """Creating a client without a name returns 400."""
        payload = {"scopes": ["read:user"]}
        response = client.post(
            "/api/v1/developer/clients", json=payload, headers=auth_headers
        )
        assert response.status_code == 400
        assert "name" in response.get_json()["error"].lower()

    def test_create_client_invalid_scopes(self, client, auth_headers, account):
        """Creating a client with invalid scopes returns 400."""
        payload = {
            "name": "Bad Scopes App",
            "scopes": ["read:user", "write:everything"],
        }
        response = client.post(
            "/api/v1/developer/clients", json=payload, headers=auth_headers
        )
        assert response.status_code == 400
        assert "invalid" in response.get_json()["error"].lower()


class TestGetClient:
    """Tests for GET /api/v1/developer/clients/<client_id>."""

    def test_get_client_existing(self, client, auth_headers, account, oauth_client):
        """Getting an existing client returns its details."""
        response = client.get(
            f"/api/v1/developer/clients/{oauth_client.client_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["client_id"] == oauth_client.client_id
        assert data["name"] == "Test OAuth App"

    def test_get_client_not_found(self, client, auth_headers, account):
        """Getting a nonexistent client returns 404."""
        response = client.get(
            "/api/v1/developer/clients/nonexistent-id", headers=auth_headers
        )
        assert response.status_code == 404

    def test_get_client_other_users(self, client, member_auth_headers, oauth_client):
        """A different user cannot access another user's client."""
        response = client.get(
            f"/api/v1/developer/clients/{oauth_client.client_id}",
            headers=member_auth_headers,
        )
        assert response.status_code == 404


class TestUpdateClient:
    """Tests for PUT /api/v1/developer/clients/<client_id>."""

    def test_update_client_name(self, client, auth_headers, account, oauth_client):
        """Updating a client's name succeeds."""
        response = client.put(
            f"/api/v1/developer/clients/{oauth_client.client_id}",
            json={"name": "Renamed App"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["client"]["name"] == "Renamed App"

    def test_update_client_scopes(self, client, auth_headers, account, oauth_client):
        """Updating a client's scopes succeeds with valid scopes."""
        new_scopes = ["read:user", "write:entries"]
        response = client.put(
            f"/api/v1/developer/clients/{oauth_client.client_id}",
            json={"scopes": new_scopes},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.get_json()["client"]["scopes"] == new_scopes

    def test_update_client_redirect_uris(self, client, auth_headers, account, oauth_client):
        """Updating redirect URIs succeeds."""
        new_uris = ["https://myapp.com/callback", "https://myapp.com/auth"]
        response = client.put(
            f"/api/v1/developer/clients/{oauth_client.client_id}",
            json={"redirect_uris": new_uris},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.get_json()["client"]["redirect_uris"] == new_uris

    def test_deactivate_client(self, client, auth_headers, account, oauth_client):
        """Setting active=false deactivates the client."""
        response = client.put(
            f"/api/v1/developer/clients/{oauth_client.client_id}",
            json={"active": False},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.get_json()["client"]["active"] is False

    def test_update_client_invalid_scopes(self, client, auth_headers, account, oauth_client):
        """Updating with invalid scopes returns 400."""
        response = client.put(
            f"/api/v1/developer/clients/{oauth_client.client_id}",
            json={"scopes": ["delete:everything"]},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "invalid" in response.get_json()["error"].lower()


class TestDeleteClient:
    """Tests for DELETE /api/v1/developer/clients/<client_id>."""

    def test_delete_client_existing(self, client, auth_headers, account, oauth_client):
        """Deleting an existing client removes it."""
        client_id = oauth_client.client_id
        response = client.delete(
            f"/api/v1/developer/clients/{client_id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert "deleted" in response.get_json()["message"].lower()

        # Verify it's gone
        get_resp = client.get(
            f"/api/v1/developer/clients/{client_id}", headers=auth_headers
        )
        assert get_resp.status_code == 404

    def test_delete_client_not_found(self, client, auth_headers, account):
        """Deleting a nonexistent client returns 404."""
        response = client.delete(
            "/api/v1/developer/clients/nonexistent-id", headers=auth_headers
        )
        assert response.status_code == 404


class TestRotateSecret:
    """Tests for POST /api/v1/developer/clients/<client_id>/rotate-secret."""

    def test_rotate_secret(self, client, auth_headers, account, oauth_client, user):
        """Rotating the secret returns a new secret and revokes old tokens."""
        # Create an existing token for this client
        access_raw = OAuthToken.generate_token()
        token = OAuthToken(
            access_token=OAuthToken.hash_token(access_raw),
            refresh_token=OAuthToken.hash_token(OAuthToken.generate_token()),
            client=oauth_client,
            user=user,
            scopes=["read:user"],
            expires_at="2099-01-01T00:00:00",
        )
        token.save()

        response = client.post(
            f"/api/v1/developer/clients/{oauth_client.client_id}/rotate-secret",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        new_secret = data["client"]["client_secret"]
        assert len(new_secret) > 0

        # Verify old token is now revoked
        token.reload()
        assert token.revoked is True

        # Verify the new secret works (the client can check it)
        oauth_client.reload()
        assert oauth_client.check_secret(new_secret) is True
        assert oauth_client.check_secret("test-client-secret") is False
