"""Tests for notification endpoints (prefix: /api/v1)."""
import datetime
import pytest
from bson import ObjectId

from app.models import Notification, NotificationPreference, NotificationChannel


class TestListNotifications:
    """Tests for GET /api/v1/notifications."""

    def test_list_all(self, client, auth_headers, account, notification):
        """Returns all notifications for the current user."""
        response = client.get("/api/v1/notifications", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["notifications"]) == 1
        assert data["pagination"]["total"] == 1
        assert data["notifications"][0]["title"] == "Test notification"

    def test_list_with_pagination(self, client, auth_headers, user, account):
        """Pagination correctly limits results per page."""
        # Create 5 notifications
        for i in range(5):
            Notification(
                user=user,
                account=account,
                notification_type="database_created",
                title=f"Notification {i}",
                message=f"Message {i}",
            ).save()

        response = client.get(
            "/api/v1/notifications?page=1&per_page=2",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["notifications"]) == 2
        assert data["pagination"]["total"] == 5
        assert data["pagination"]["pages"] == 3

    def test_list_unread_only(self, client, auth_headers, user, account):
        """Filtering by unread_only returns only unread notifications."""
        # Create one read and one unread notification
        Notification(
            user=user, account=account,
            notification_type="database_created",
            title="Read one", message="Already read",
            read=True, read_at=datetime.datetime.utcnow(),
        ).save()
        Notification(
            user=user, account=account,
            notification_type="database_updated",
            title="Unread one", message="Not yet read",
            read=False,
        ).save()

        response = client.get(
            "/api/v1/notifications?unread_only=true",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["notifications"]) == 1
        assert data["notifications"][0]["title"] == "Unread one"


class TestUnreadCount:
    """Tests for GET /api/v1/notifications/unread-count."""

    def test_unread_count(self, client, auth_headers, user, account):
        """Returns the correct unread notification count."""
        # Create 3 notifications: 2 unread, 1 read
        for i in range(2):
            Notification(
                user=user, account=account,
                notification_type="database_created",
                title=f"Unread {i}", message="msg",
            ).save()
        Notification(
            user=user, account=account,
            notification_type="database_created",
            title="Read", message="msg",
            read=True,
        ).save()

        response = client.get("/api/v1/notifications/unread-count", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["unread_count"] == 2


class TestMarkAsRead:
    """Tests for PUT /api/v1/notifications/<id>/read."""

    def test_mark_as_read(self, client, auth_headers, notification):
        """Marks a single notification as read."""
        notif_id = str(notification.id)
        response = client.put(
            f"/api/v1/notifications/{notif_id}/read",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["notification"]["read"] is True
        assert data["notification"]["read_at"] is not None

    def test_mark_as_read_not_found(self, client, auth_headers, account):
        """Returns 404 for a nonexistent notification."""
        fake_id = str(ObjectId())
        response = client.put(
            f"/api/v1/notifications/{fake_id}/read",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestMarkAllAsRead:
    """Tests for PUT /api/v1/notifications/read-all."""

    def test_mark_all_as_read(self, client, auth_headers, user, account):
        """Marks all unread notifications as read."""
        for i in range(3):
            Notification(
                user=user, account=account,
                notification_type="database_created",
                title=f"Notif {i}", message="msg",
            ).save()

        response = client.put("/api/v1/notifications/read-all", headers=auth_headers)
        assert response.status_code == 200

        # Verify all are now read
        unread = Notification.objects(user=user, read=False).count()
        assert unread == 0


class TestDeleteNotification:
    """Tests for DELETE /api/v1/notifications/<id>."""

    def test_delete_notification(self, client, auth_headers, notification):
        """Deletes a notification successfully."""
        notif_id = str(notification.id)
        response = client.delete(
            f"/api/v1/notifications/{notif_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "deleted" in data["message"].lower()
        assert Notification.objects(id=notif_id).first() is None

    def test_delete_not_found(self, client, auth_headers, account):
        """Returns 404 when deleting a nonexistent notification."""
        fake_id = str(ObjectId())
        response = client.delete(
            f"/api/v1/notifications/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestGetNotificationPreferences:
    """Tests for GET /api/v1/notifications/preferences."""

    def test_get_preferences_creates_defaults(self, client, auth_headers, account):
        """Creates default preferences when none exist and returns them."""
        response = client.get("/api/v1/notifications/preferences", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        prefs = data["preferences"]
        assert prefs["email_enabled"] is True
        assert prefs["team_invites"]["in_app"] is True
        assert prefs["team_invites"]["email"] is True
        assert prefs["entry_modifications"]["in_app"] is False


class TestUpdateNotificationPreferences:
    """Tests for PUT /api/v1/notifications/preferences."""

    def test_update_email_enabled(self, client, auth_headers, account):
        """Updates the global email_enabled toggle."""
        response = client.put(
            "/api/v1/notifications/preferences",
            headers=auth_headers,
            json={"email_enabled": False},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["preferences"]["email_enabled"] is False

    def test_update_categories(self, client, auth_headers, account):
        """Updates per-category channel settings."""
        response = client.put(
            "/api/v1/notifications/preferences",
            headers=auth_headers,
            json={
                "database_changes": {"in_app": True, "email": True},
                "entry_modifications": {"in_app": True, "email": False},
            },
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["preferences"]["database_changes"]["email"] is True
        assert data["preferences"]["entry_modifications"]["in_app"] is True


class TestUnsubscribe:
    """Tests for GET /api/v1/notifications/unsubscribe/<token>."""

    def test_valid_token(self, client, auth_headers, user, account):
        """Unsubscribes user from emails with a valid token."""
        prefs = NotificationPreference.get_or_create(user)
        token = prefs.unsubscribe_token

        response = client.get(f"/api/v1/notifications/unsubscribe/{token}")
        assert response.status_code == 200
        data = response.get_json()
        assert "unsubscribed" in data["message"].lower()

        # Verify email_enabled is now False
        prefs.reload()
        assert prefs.email_enabled is False

    def test_invalid_token(self, client):
        """Returns 404 for an invalid unsubscribe token."""
        response = client.get("/api/v1/notifications/unsubscribe/totally-bogus-token")
        assert response.status_code == 404
        data = response.get_json()
        assert "invalid" in data["error"].lower()
