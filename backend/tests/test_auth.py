"""Tests for authentication endpoints."""
import pytest


class TestRegister:
    """Tests for user registration."""

    def test_register_success(self, client):
        """Test successful user registration."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securepassword123",
                "first_name": "New",
                "last_name": "User",
            },
        )
        assert response.status_code == 201
        data = response.get_json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "newuser@example.com"

    def test_register_duplicate_email(self, client, user):
        """Test registration with existing email."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "securepassword123",
            },
        )
        assert response.status_code == 409
        assert "already registered" in response.get_json()["error"]

    def test_register_invalid_email(self, client):
        """Test registration with invalid email."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "notanemail",
                "password": "securepassword123",
            },
        )
        assert response.status_code == 400

    def test_register_short_password(self, client):
        """Test registration with short password."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "valid@example.com",
                "password": "short",
            },
        )
        assert response.status_code == 400


class TestLogin:
    """Tests for user login."""

    def test_login_success(self, client, user):
        """Test successful login."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_wrong_password(self, client, user):
        """Test login with wrong password."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        """Test login with nonexistent email."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 401


class TestLogout:
    """Tests for user logout."""

    def test_logout_success(self, client, auth_headers):
        """Test successful logout."""
        response = client.post("/api/v1/auth/logout", headers=auth_headers)
        assert response.status_code == 200

    def test_logout_no_token(self, client):
        """Test logout without token."""
        response = client.post("/api/v1/auth/logout")
        assert response.status_code == 401


class TestRefresh:
    """Tests for token refresh."""

    def test_refresh_success(self, client, user):
        """Test successful token refresh."""
        # First login to get refresh token
        login_response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "password123",
            },
        )
        refresh_token = login_response.get_json()["refresh_token"]

        # Use refresh token
        response = client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )
        assert response.status_code == 200
        assert "access_token" in response.get_json()


class TestGetCurrentUser:
    """Tests for getting current user."""

    def test_get_current_user_success(self, client, auth_headers, user):
        """Test getting current user info."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["email"] == "test@example.com"

    def test_get_current_user_no_auth(self, client):
        """Test getting current user without auth."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401
