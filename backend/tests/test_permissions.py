"""Tests for permission checking utilities and decorators."""
import pytest

from app.models import (
    User, Account, AccountMembership, ResourcePermissions, Permissions,
    Database, Field, Entry,
)
from app.api.v1.permissions import is_account_admin


class TestAdminPermissions:
    """Admin users should have full CRUD access."""

    def test_admin_can_create_database(self, client, auth_headers, account, app):
        """Admin can create a new database."""
        response = client.post(
            "/api/v1/databases",
            headers=auth_headers,
            json={"title": "Admin DB"},
        )
        assert response.status_code == 201

    def test_admin_can_read_database(self, client, auth_headers, account, database):
        """Admin can read an existing database."""
        response = client.get(
            f"/api/v1/databases/{database.slug}",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_admin_can_update_database(self, client, auth_headers, account, database):
        """Admin can update database details."""
        response = client.put(
            f"/api/v1/databases/{database.slug}",
            headers=auth_headers,
            json={"title": "Updated Title"},
        )
        assert response.status_code == 200

    def test_admin_can_delete_database(self, client, auth_headers, account, database):
        """Admin can delete a database."""
        response = client.delete(
            f"/api/v1/databases/{database.slug}",
            headers=auth_headers,
        )
        assert response.status_code == 200


class TestMemberPermissions:
    """Member users should have limited access based on default member permissions."""

    def test_member_cannot_create_database(self, client, member_auth_headers, account):
        """Member (default permissions) cannot create a database."""
        response = client.post(
            "/api/v1/databases",
            headers=member_auth_headers,
            json={"title": "Member DB"},
        )
        assert response.status_code == 403

    def test_member_can_read_database(self, client, member_auth_headers, account, database):
        """Member can read an existing database."""
        response = client.get(
            f"/api/v1/databases/{database.slug}",
            headers=member_auth_headers,
        )
        assert response.status_code == 200

    def test_member_can_create_entry(self, client, member_auth_headers, account, database, field):
        """Member can create entries (default member permission)."""
        response = client.post(
            f"/api/v1/databases/{database.slug}/entries",
            headers=member_auth_headers,
            json={"values": {"test_field": "member value"}},
        )
        assert response.status_code == 201

    def test_member_cannot_delete_entry(self, client, member_auth_headers, account, database, entry):
        """Member cannot delete entries (default member permission denies delete)."""
        response = client.delete(
            f"/api/v1/databases/{database.slug}/entries/{str(entry.id)}",
            headers=member_auth_headers,
        )
        assert response.status_code == 403


class TestRequireAdminDecorator:
    """Tests for the require_admin decorator on protected endpoints."""

    def test_require_admin_returns_403_for_member(self, client, member_auth_headers, account):
        """Endpoints decorated with require_admin deny members."""
        # POST /api/v1/users/account/members requires admin
        response = client.post(
            "/api/v1/users/account/members",
            headers=member_auth_headers,
            json={"email": "another@example.com", "role": "member"},
        )
        assert response.status_code == 403
        data = response.get_json()
        assert "admin" in data["error"].lower()

    def test_require_admin_allows_admin(self, client, auth_headers, account, app):
        """Endpoints decorated with require_admin allow admins."""
        app.config["FREE_TIER_MAX_MEMBERS"] = 100
        response = client.post(
            "/api/v1/users/account/members",
            headers=auth_headers,
            json={"email": "yetanother@example.com", "role": "member"},
        )
        assert response.status_code == 201


class TestNoActiveAccountLegacyMode:
    """When a user has no active account, all operations should be allowed (legacy mode)."""

    def test_no_account_allows_create_database(self, client, auth_headers):
        """User without an active account can create databases in legacy mode."""
        response = client.post(
            "/api/v1/databases",
            headers=auth_headers,
            json={"title": "Legacy DB"},
        )
        # Without an account, the check_permission decorator allows the operation
        assert response.status_code == 201


class TestIsAccountAdminUtility:
    """Tests for the is_account_admin utility function."""

    def test_is_admin_true(self, app, user, account):
        """Returns True for admin members."""
        assert is_account_admin(user, account) is True

    def test_is_admin_false_for_member(self, app, second_user, account, member_membership):
        """Returns False for non-admin members."""
        assert is_account_admin(second_user, account) is False

    def test_is_admin_no_account(self, app, user):
        """Returns False when no account is specified and user has no active account."""
        # user has no active_account set in this test (no account fixture)
        assert is_account_admin(user) is False
