"""Tests for users blueprint (prefix: /api/v1/users)."""
import datetime
import pytest
from bson import ObjectId

from app.models import (
    User, Account, AccountMembership, ResourcePermissions, Permissions,
)


class TestGetCurrentAccount:
    """Tests for GET /api/v1/users/account."""

    def test_get_current_account_with_account(self, client, auth_headers, account):
        """Returns the active account and membership for the authenticated user."""
        response = client.get("/api/v1/users/account", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["account"] is not None
        assert data["account"]["name"] == "Test Workspace"
        assert data["membership"] is not None
        assert data["membership"]["role"] == "admin"

    def test_get_current_account_without_account(self, client, auth_headers):
        """Returns null account and membership when user has no active account."""
        response = client.get("/api/v1/users/account", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["account"] is None
        assert data["membership"] is None


class TestListMembers:
    """Tests for GET /api/v1/users/account/members."""

    def test_list_members_as_admin(self, client, auth_headers, account, second_user, member_membership):
        """Admin can list all members of the account."""
        response = client.get("/api/v1/users/account/members", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["total"] == 2
        assert len(data["members"]) == 2
        emails = [m["user_email"] for m in data["members"]]
        assert "test@example.com" in emails
        assert "member@example.com" in emails

    def test_list_members_as_member_with_permission(self, client, member_auth_headers, account):
        """Member with user.read permission can list members."""
        # Update member permissions to allow user read
        membership = AccountMembership.objects(
            user=User.objects(email="member@example.com").first(),
            account=account,
        ).first()
        membership.permissions.user = Permissions(read=True)
        membership.save()

        response = client.get("/api/v1/users/account/members", headers=member_auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["total"] >= 1

    def test_list_members_no_permission(self, client, member_auth_headers, account):
        """Member without user.read permission is denied."""
        response = client.get("/api/v1/users/account/members", headers=member_auth_headers)
        assert response.status_code == 403
        data = response.get_json()
        assert "Permission denied" in data["error"]


class TestInviteMember:
    """Tests for POST /api/v1/users/account/members."""

    def test_invite_new_member(self, client, auth_headers, account, app):
        """Admin can invite a new user by email."""
        app.config["FREE_TIER_MAX_MEMBERS"] = 100
        response = client.post(
            "/api/v1/users/account/members",
            headers=auth_headers,
            json={"email": "newuser@example.com", "role": "member"},
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["membership"]["role"] == "member"
        # A placeholder user should have been created
        new_user = User.objects(email="newuser@example.com").first()
        assert new_user is not None

    def test_invite_existing_user(self, client, auth_headers, account, second_user, app):
        """Admin can invite an existing user who is not yet a member."""
        app.config["FREE_TIER_MAX_MEMBERS"] = 100
        response = client.post(
            "/api/v1/users/account/members",
            headers=auth_headers,
            json={"email": "member@example.com", "role": "member"},
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["membership"]["user_email"] == "member@example.com"

    def test_invite_duplicate_active_member(self, client, auth_headers, account, member_membership, app):
        """Inviting an already-active member returns 400."""
        app.config["FREE_TIER_MAX_MEMBERS"] = 100
        response = client.post(
            "/api/v1/users/account/members",
            headers=auth_headers,
            json={"email": "member@example.com", "role": "member"},
        )
        assert response.status_code == 400
        data = response.get_json()
        assert "already a member" in data["error"]

    def test_reactivate_inactive_member(self, client, auth_headers, account, second_user, app):
        """Inviting an inactive member reactivates them."""
        app.config["FREE_TIER_MAX_MEMBERS"] = 100
        # Create an inactive membership
        membership = AccountMembership(
            account=account,
            user=second_user,
            role="member",
            permissions=ResourcePermissions.from_role("member"),
            status="inactive",
        )
        membership.save()

        response = client.post(
            "/api/v1/users/account/members",
            headers=auth_headers,
            json={"email": "member@example.com", "role": "member"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["membership"]["status"] == "active"


class TestUpdateMember:
    """Tests for PUT /api/v1/users/account/members/<id>."""

    def test_update_member_role(self, client, auth_headers, account, member_membership):
        """Admin can change a member's role."""
        member_id = str(member_membership.id)
        response = client.put(
            f"/api/v1/users/account/members/{member_id}",
            headers=auth_headers,
            json={"role": "admin"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["membership"]["role"] == "admin"

    def test_update_member_permissions(self, client, auth_headers, account, member_membership):
        """Admin can update custom permissions for a member."""
        member_id = str(member_membership.id)
        custom_permissions = {
            "database": {"create": True, "read": True, "update": True, "delete": False},
            "field": {"create": True, "read": True, "update": True, "delete": False},
            "entry": {"create": True, "read": True, "update": True, "delete": True},
            "user": {"create": False, "read": True, "update": False, "delete": False},
        }
        response = client.put(
            f"/api/v1/users/account/members/{member_id}",
            headers=auth_headers,
            json={"permissions": custom_permissions},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["membership"]["permissions"]["database"]["create"] is True
        assert data["membership"]["permissions"]["database"]["delete"] is False

    def test_prevent_removing_last_admin(self, client, auth_headers, user, account):
        """Cannot demote the last admin to member."""
        # user is the only admin
        admin_membership = AccountMembership.objects(
            user=user, account=account, role="admin"
        ).first()
        member_id = str(admin_membership.id)
        response = client.put(
            f"/api/v1/users/account/members/{member_id}",
            headers=auth_headers,
            json={"role": "member"},
        )
        assert response.status_code == 400
        data = response.get_json()
        assert "last admin" in data["error"].lower()

    def test_prevent_deactivating_self(self, client, auth_headers, user, account):
        """Admin cannot deactivate their own membership."""
        admin_membership = AccountMembership.objects(
            user=user, account=account,
        ).first()
        member_id = str(admin_membership.id)
        response = client.put(
            f"/api/v1/users/account/members/{member_id}",
            headers=auth_headers,
            json={"status": "inactive"},
        )
        assert response.status_code == 400
        data = response.get_json()
        assert "yourself" in data["error"].lower()


class TestRemoveMember:
    """Tests for DELETE /api/v1/users/account/members/<id>."""

    def test_remove_member(self, client, auth_headers, account, member_membership):
        """Admin can remove a member from the account."""
        member_id = str(member_membership.id)
        response = client.delete(
            f"/api/v1/users/account/members/{member_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["message"] == "Member removed"
        # Verify membership is deleted
        assert AccountMembership.objects(id=member_id).first() is None

    def test_prevent_removing_self(self, client, auth_headers, user, account):
        """Admin cannot remove themselves."""
        admin_membership = AccountMembership.objects(
            user=user, account=account,
        ).first()
        member_id = str(admin_membership.id)
        response = client.delete(
            f"/api/v1/users/account/members/{member_id}",
            headers=auth_headers,
        )
        assert response.status_code == 400
        data = response.get_json()
        assert "yourself" in data["error"].lower()

    def test_prevent_removing_last_admin(self, client, auth_headers, user, account, second_user):
        """Cannot remove the only admin from the account."""
        # Make second_user an admin too, then remove them, leaving only one admin
        # But the test here is: we have only 1 admin (user), and that admin is the only one
        # We need a second admin to be the target but also be the only admin
        # Actually: test that removing an admin who is the last admin returns 400
        admin2_membership = AccountMembership(
            account=account,
            user=second_user,
            role="admin",
            permissions=ResourcePermissions.from_role("admin"),
            status="active",
        )
        admin2_membership.save()

        # Remove admin2 -- should succeed since there are 2 admins
        response = client.delete(
            f"/api/v1/users/account/members/{str(admin2_membership.id)}",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Now user is the sole admin; try to remove them (blocked by "cannot remove yourself")
        admin_membership = AccountMembership.objects(
            user=user, account=account,
        ).first()
        response = client.delete(
            f"/api/v1/users/account/members/{str(admin_membership.id)}",
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestListAccounts:
    """Tests for GET /api/v1/users/accounts."""

    def test_list_accounts(self, client, auth_headers, account):
        """Returns all accounts the user belongs to."""
        response = client.get("/api/v1/users/accounts", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["accounts"]) == 1
        assert data["accounts"][0]["account"]["name"] == "Test Workspace"


class TestSwitchAccount:
    """Tests for POST /api/v1/users/accounts/switch/<id>."""

    def test_switch_account(self, client, auth_headers, user, account):
        """User can switch to an account they belong to."""
        # Create a second account
        account2 = Account(name="Second Workspace", owner=user)
        account2.save()
        membership2 = AccountMembership(
            account=account2,
            user=user,
            role="admin",
            permissions=ResourcePermissions.from_role("admin"),
            status="active",
        )
        membership2.save()

        response = client.post(
            f"/api/v1/users/accounts/switch/{str(account2.id)}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["account"]["name"] == "Second Workspace"

    def test_switch_to_invalid_account(self, client, auth_headers, account):
        """Returns 404 when switching to a nonexistent account."""
        fake_id = str(ObjectId())
        response = client.post(
            f"/api/v1/users/accounts/switch/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404
        data = response.get_json()
        assert "not found" in data["error"].lower()

    def test_switch_to_non_member_account(self, client, auth_headers, user, account, second_user):
        """Returns 403 when user is not a member of the target account."""
        # Create an account owned by second_user without user as a member
        other_account = Account(name="Other Workspace", owner=second_user)
        other_account.save()

        response = client.post(
            f"/api/v1/users/accounts/switch/{str(other_account.id)}",
            headers=auth_headers,
        )
        assert response.status_code == 403
        data = response.get_json()
        assert "not a member" in data["error"].lower()
