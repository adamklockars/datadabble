"""Tests for social OAuth endpoints (/api/v1/auth/oauth)."""
import pytest
from unittest.mock import patch, MagicMock
from app.models import User, Account, AccountMembership, SocialAccount


class TestOAuthAuthorize:
    """Tests for GET /api/v1/auth/oauth/<provider>/authorize."""

    def test_google_authorize_returns_redirect_url(self, client, app):
        """Google authorize endpoint returns an authorization URL with correct params."""
        app.config["GOOGLE_CLIENT_ID"] = "test-google-client-id"
        app.config["GOOGLE_CLIENT_SECRET"] = "test-google-secret"
        app.config["GOOGLE_REDIRECT_URI"] = "http://localhost:5173/auth/callback/google"

        response = client.get("/api/v1/auth/oauth/google/authorize")
        assert response.status_code == 200
        data = response.get_json()
        assert "authorization_url" in data
        assert "state" in data
        url = data["authorization_url"]
        assert "accounts.google.com" in url
        assert "test-google-client-id" in url
        assert "openid" in url or "email" in url

    def test_github_authorize_returns_redirect_url(self, client, app):
        """GitHub authorize endpoint returns an authorization URL."""
        app.config["GITHUB_CLIENT_ID"] = "test-github-client-id"
        app.config["GITHUB_CLIENT_SECRET"] = "test-github-secret"
        app.config["GITHUB_REDIRECT_URI"] = "http://localhost:5173/auth/callback/github"

        response = client.get("/api/v1/auth/oauth/github/authorize")
        assert response.status_code == 200
        data = response.get_json()
        assert "authorization_url" in data
        assert "github.com" in data["authorization_url"]


class TestOAuthCallback:
    """Tests for POST /api/v1/auth/oauth/<provider>/callback."""

    @patch("app.api.v1.oauth.http_requests.get")
    @patch("app.api.v1.oauth.OAuth2Session")
    def test_google_callback_creates_user(self, mock_session_cls, mock_get, client, app):
        """Google callback with valid code creates a new user and returns JWT tokens."""
        app.config["GOOGLE_CLIENT_ID"] = "test-google-client-id"
        app.config["GOOGLE_CLIENT_SECRET"] = "test-google-secret"
        app.config["GOOGLE_REDIRECT_URI"] = "http://localhost:5173/auth/callback/google"

        # Mock the OAuth2Session instance and token exchange
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.fetch_token.return_value = {"access_token": "google-access-token"}

        # Mock the Google userinfo response
        mock_userinfo_resp = MagicMock()
        mock_userinfo_resp.status_code = 200
        mock_userinfo_resp.json.return_value = {
            "sub": "google-user-123",
            "email": "oauth-new@example.com",
            "name": "OAuth User",
            "picture": "https://example.com/avatar.png",
        }
        mock_userinfo_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_userinfo_resp

        response = client.post(
            "/api/v1/auth/oauth/google/callback",
            json={"code": "valid-google-auth-code"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "oauth-new@example.com"

        # Verify user was created in the database
        user = User.objects(email="oauth-new@example.com").first()
        assert user is not None
        assert user.first_name == "OAuth"
        assert user.last_name == "User"
        assert len(user.social_accounts) == 1
        assert user.social_accounts[0].provider == "google"
        assert user.social_accounts[0].provider_user_id == "google-user-123"

        # Verify an account and membership were created
        assert user.active_account is not None
        membership = AccountMembership.objects(user=user, status="active").first()
        assert membership is not None
        assert membership.role == "admin"

    @patch("app.api.v1.oauth.http_requests.get")
    @patch("app.api.v1.oauth.OAuth2Session")
    def test_google_callback_existing_user_links_social(
        self, mock_session_cls, mock_get, client, app, user, account
    ):
        """Google callback for an existing user links the social account."""
        app.config["GOOGLE_CLIENT_ID"] = "test-google-client-id"
        app.config["GOOGLE_CLIENT_SECRET"] = "test-google-secret"
        app.config["GOOGLE_REDIRECT_URI"] = "http://localhost:5173/auth/callback/google"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.fetch_token.return_value = {"access_token": "google-access-token"}

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "sub": "google-existing-456",
            "email": "test@example.com",  # Matches the existing test user
            "name": "Test User",
            "picture": "https://example.com/pic.png",
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        response = client.post(
            "/api/v1/auth/oauth/google/callback",
            json={"code": "valid-code"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["user"]["email"] == "test@example.com"

        # Verify social account was linked
        user.reload()
        assert any(
            sa.provider == "google" and sa.provider_user_id == "google-existing-456"
            for sa in (user.social_accounts or [])
        )

    @patch("app.api.v1.oauth.http_requests.get")
    @patch("app.api.v1.oauth.OAuth2Session")
    def test_github_callback_creates_user(self, mock_session_cls, mock_get, client, app):
        """GitHub callback with valid code creates a new user."""
        app.config["GITHUB_CLIENT_ID"] = "test-github-client-id"
        app.config["GITHUB_CLIENT_SECRET"] = "test-github-secret"
        app.config["GITHUB_REDIRECT_URI"] = "http://localhost:5173/auth/callback/github"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.fetch_token.return_value = {"access_token": "github-access-token"}

        # GitHub returns user profile then emails in separate calls
        mock_profile_resp = MagicMock()
        mock_profile_resp.json.return_value = {
            "id": 789,
            "login": "octodev",
            "name": "Octo Developer",
            "email": "octo@github-mail.com",
            "avatar_url": "https://avatars.githubusercontent.com/u/789",
        }
        mock_profile_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_profile_resp

        response = client.post(
            "/api/v1/auth/oauth/github/callback",
            json={"code": "valid-github-code"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "access_token" in data
        assert data["user"]["email"] == "octo@github-mail.com"

        user = User.objects(email="octo@github-mail.com").first()
        assert user is not None
        assert user.social_accounts[0].provider == "github"
        assert user.social_accounts[0].provider_user_id == "789"

    def test_unsupported_provider(self, client, app):
        """Using an unsupported provider returns 400."""
        response = client.post(
            "/api/v1/auth/oauth/twitter/callback",
            json={"code": "some-code"},
        )
        assert response.status_code == 400
        assert "unsupported" in response.get_json()["error"].lower()

    @patch("app.api.v1.oauth.OAuth2Session")
    def test_google_callback_invalid_code(self, mock_session_cls, client, app):
        """Google callback with an invalid code returns error when token exchange fails."""
        app.config["GOOGLE_CLIENT_ID"] = "test-google-client-id"
        app.config["GOOGLE_CLIENT_SECRET"] = "test-google-secret"
        app.config["GOOGLE_REDIRECT_URI"] = "http://localhost:5173/auth/callback/google"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.fetch_token.side_effect = Exception("Token exchange failed")

        response = client.post(
            "/api/v1/auth/oauth/google/callback",
            json={"code": "invalid-code"},
        )
        assert response.status_code == 400
        assert "failed" in response.get_json()["error"].lower()

    def test_google_callback_missing_code(self, client, app):
        """Google callback without a code parameter returns 400."""
        app.config["GOOGLE_CLIENT_ID"] = "test-google-client-id"
        app.config["GOOGLE_CLIENT_SECRET"] = "test-google-secret"
        app.config["GOOGLE_REDIRECT_URI"] = "http://localhost:5173/auth/callback/google"

        response = client.post(
            "/api/v1/auth/oauth/google/callback",
            json={},
        )
        assert response.status_code == 400
        assert "code" in response.get_json()["error"].lower()

    def test_google_authorize_not_configured(self, client, app):
        """When Google OAuth is not configured, authorize returns 400."""
        app.config["GOOGLE_CLIENT_ID"] = ""
        app.config["GOOGLE_CLIENT_SECRET"] = ""

        response = client.get("/api/v1/auth/oauth/google/authorize")
        assert response.status_code == 400
        assert "not configured" in response.get_json()["error"].lower()
