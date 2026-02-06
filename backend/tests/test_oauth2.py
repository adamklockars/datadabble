"""Tests for OAuth 2.0 authorization server endpoints (/api/v1/oauth2)."""
import datetime
import pytest
from app.models import OAuthClient, OAuthAuthorizationCode, OAuthToken


class TestOAuth2Authorize:
    """Tests for GET /api/v1/oauth2/authorize (consent info)."""

    def test_get_consent_info_valid(self, client, auth_headers, account, oauth_client):
        """Valid authorization request returns client info and scopes."""
        response = client.get(
            "/api/v1/oauth2/authorize",
            query_string={
                "client_id": oauth_client.client_id,
                "redirect_uri": "http://localhost:3000/callback",
                "scope": "read:user read:databases",
                "state": "random-state-value",
                "response_type": "code",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["client"]["client_id"] == oauth_client.client_id
        assert data["client"]["name"] == "Test OAuth App"
        assert data["redirect_uri"] == "http://localhost:3000/callback"
        assert data["state"] == "random-state-value"
        assert len(data["scopes"]) == 2

    def test_missing_client_id(self, client, auth_headers, account):
        """Missing client_id returns error."""
        response = client.get(
            "/api/v1/oauth2/authorize",
            query_string={
                "redirect_uri": "http://localhost:3000/callback",
                "response_type": "code",
            },
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert response.get_json()["error"] == "invalid_request"

    def test_invalid_client(self, client, auth_headers, account):
        """Nonexistent client_id returns invalid_client error."""
        response = client.get(
            "/api/v1/oauth2/authorize",
            query_string={
                "client_id": "does-not-exist",
                "redirect_uri": "http://localhost:3000/callback",
                "response_type": "code",
            },
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert response.get_json()["error"] == "invalid_client"

    def test_invalid_redirect_uri(self, client, auth_headers, account, oauth_client):
        """Redirect URI not in registered list returns error."""
        response = client.get(
            "/api/v1/oauth2/authorize",
            query_string={
                "client_id": oauth_client.client_id,
                "redirect_uri": "https://evil.example.com/steal",
                "scope": "read:user",
                "response_type": "code",
            },
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "redirect_uri" in response.get_json()["error_description"]

    def test_invalid_scopes(self, client, auth_headers, account, oauth_client):
        """Requesting scopes not defined in the system returns error."""
        response = client.get(
            "/api/v1/oauth2/authorize",
            query_string={
                "client_id": oauth_client.client_id,
                "redirect_uri": "http://localhost:3000/callback",
                "scope": "read:user admin:everything",
                "response_type": "code",
            },
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert response.get_json()["error"] == "invalid_scope"


class TestOAuth2AuthorizeConsent:
    """Tests for POST /api/v1/oauth2/authorize (process consent)."""

    def test_approve_consent_returns_code(self, client, auth_headers, account, oauth_client):
        """Approving consent returns an authorization code."""
        response = client.post(
            "/api/v1/oauth2/authorize",
            json={
                "client_id": oauth_client.client_id,
                "redirect_uri": "http://localhost:3000/callback",
                "scopes": ["read:user", "read:databases"],
                "state": "my-state",
                "approved": True,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "code" in data
        assert len(data["code"]) > 0
        assert data["state"] == "my-state"
        assert data["redirect_uri"] == "http://localhost:3000/callback"

    def test_deny_consent_returns_error(self, client, auth_headers, account, oauth_client):
        """Denying consent returns access_denied error without a code."""
        response = client.post(
            "/api/v1/oauth2/authorize",
            json={
                "client_id": oauth_client.client_id,
                "redirect_uri": "http://localhost:3000/callback",
                "scopes": ["read:user"],
                "state": "my-state",
                "approved": False,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["error"] == "access_denied"
        assert "code" not in data


class TestOAuth2Token:
    """Tests for POST /api/v1/oauth2/token."""

    def test_exchange_code_for_tokens(self, client, account, oauth_client, oauth_authorization_code):
        """Valid authorization_code grant returns access and refresh tokens."""
        response = client.post(
            "/api/v1/oauth2/token",
            json={
                "grant_type": "authorization_code",
                "code": "test-auth-code-12345",
                "client_id": oauth_client.client_id,
                "client_secret": "test-client-secret",
                "redirect_uri": "http://localhost:3000/callback",
            },
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "Bearer"
        assert data["expires_in"] == 3600
        assert "read:user" in data["scope"]

    def test_invalid_code(self, client, account, oauth_client):
        """Using an invalid code returns error."""
        response = client.post(
            "/api/v1/oauth2/token",
            json={
                "grant_type": "authorization_code",
                "code": "wrong-code",
                "client_id": oauth_client.client_id,
                "client_secret": "test-client-secret",
            },
        )
        assert response.status_code == 400
        assert response.get_json()["error"] == "invalid_grant"

    def test_expired_code(self, client, account, oauth_client, user):
        """Using an expired code returns error."""
        expired_code = OAuthAuthorizationCode(
            code="expired-code-xyz",
            client=oauth_client,
            user=user,
            scopes=["read:user"],
            redirect_uri="http://localhost:3000/callback",
            expires_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=1),
        )
        expired_code.save()

        response = client.post(
            "/api/v1/oauth2/token",
            json={
                "grant_type": "authorization_code",
                "code": "expired-code-xyz",
                "client_id": oauth_client.client_id,
                "client_secret": "test-client-secret",
            },
        )
        assert response.status_code == 400
        assert "expired" in response.get_json()["error_description"].lower()

    def test_already_used_code(self, client, account, oauth_client, oauth_authorization_code):
        """Using an already-used code returns error."""
        # First exchange should succeed
        client.post(
            "/api/v1/oauth2/token",
            json={
                "grant_type": "authorization_code",
                "code": "test-auth-code-12345",
                "client_id": oauth_client.client_id,
                "client_secret": "test-client-secret",
                "redirect_uri": "http://localhost:3000/callback",
            },
        )

        # Second exchange with same code should fail
        response = client.post(
            "/api/v1/oauth2/token",
            json={
                "grant_type": "authorization_code",
                "code": "test-auth-code-12345",
                "client_id": oauth_client.client_id,
                "client_secret": "test-client-secret",
                "redirect_uri": "http://localhost:3000/callback",
            },
        )
        assert response.status_code == 400
        assert "already used" in response.get_json()["error_description"].lower()

    def test_client_secret_mismatch(self, client, account, oauth_client, oauth_authorization_code):
        """Wrong client_secret returns invalid_client error."""
        response = client.post(
            "/api/v1/oauth2/token",
            json={
                "grant_type": "authorization_code",
                "code": "test-auth-code-12345",
                "client_id": oauth_client.client_id,
                "client_secret": "wrong-secret",
            },
        )
        assert response.status_code == 401
        assert response.get_json()["error"] == "invalid_client"

    def test_refresh_token_grant(self, client, account, oauth_client, user):
        """Refresh token grant issues new access and refresh tokens."""
        # Create an existing token pair
        access_raw = OAuthToken.generate_token()
        refresh_raw = OAuthToken.generate_token()
        token = OAuthToken(
            access_token=OAuthToken.hash_token(access_raw),
            refresh_token=OAuthToken.hash_token(refresh_raw),
            client=oauth_client,
            user=user,
            scopes=["read:user"],
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        )
        token.save()

        response = client.post(
            "/api/v1/oauth2/token",
            json={
                "grant_type": "refresh_token",
                "refresh_token": refresh_raw,
                "client_id": oauth_client.client_id,
                "client_secret": "test-client-secret",
            },
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "access_token" in data
        assert "refresh_token" in data
        # New tokens should be different from old ones
        assert data["access_token"] != access_raw
        assert data["refresh_token"] != refresh_raw

        # Old token should be revoked
        token.reload()
        assert token.revoked is True


class TestOAuth2Revoke:
    """Tests for POST /api/v1/oauth2/revoke."""

    def test_revoke_access_token(self, client, account, oauth_client, user):
        """Revoking an access token marks it as revoked."""
        access_raw = OAuthToken.generate_token()
        token = OAuthToken(
            access_token=OAuthToken.hash_token(access_raw),
            refresh_token=OAuthToken.hash_token(OAuthToken.generate_token()),
            client=oauth_client,
            user=user,
            scopes=["read:user"],
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        )
        token.save()

        response = client.post(
            "/api/v1/oauth2/revoke", json={"token": access_raw}
        )
        assert response.status_code == 200

        token.reload()
        assert token.revoked is True

    def test_revoke_refresh_token(self, client, account, oauth_client, user):
        """Revoking a refresh token marks it as revoked."""
        refresh_raw = OAuthToken.generate_token()
        token = OAuthToken(
            access_token=OAuthToken.hash_token(OAuthToken.generate_token()),
            refresh_token=OAuthToken.hash_token(refresh_raw),
            client=oauth_client,
            user=user,
            scopes=["read:user"],
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        )
        token.save()

        response = client.post(
            "/api/v1/oauth2/revoke", json={"token": refresh_raw}
        )
        assert response.status_code == 200

        token.reload()
        assert token.revoked is True

    def test_revoke_nonexistent_token_still_200(self, client, app):
        """Revoking a token that does not exist still returns 200 per RFC 7009."""
        response = client.post(
            "/api/v1/oauth2/revoke", json={"token": "nonexistent-token-value"}
        )
        assert response.status_code == 200


class TestOAuth2UserInfo:
    """Tests for GET /api/v1/oauth2/userinfo."""

    def test_get_user_info(self, client, auth_headers, user, account):
        """Authenticated user can retrieve their profile info."""
        response = client.get("/api/v1/oauth2/userinfo", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["email"] == "test@example.com"
        assert data["given_name"] == "Test"
        assert data["family_name"] == "User"
        assert "sub" in data
