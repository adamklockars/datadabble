"""Tests for the notification service module."""
import pytest
from app.models import (
    Notification, NotificationPreference, NotificationChannel,
    AccountMembership, ResourcePermissions,
)
from app.api.v1.notification_service import (
    create_notification, notify_account_members, send_email_notification,
)


class TestCreateNotification:
    """Tests for create_notification function."""

    def test_creates_notification_when_in_app_enabled(self, app, user, account):
        """When in_app is enabled for the category, a Notification document is created."""
        with app.app_context():
            # Create preferences with database_changes.in_app = True (the default)
            prefs = NotificationPreference(
                user=user,
                email_enabled=False,
                database_changes=NotificationChannel(in_app=True, email=False),
            )
            prefs.save()

            create_notification(
                recipient=user,
                notification_type="database_created",
                title="New database",
                message="Database 'Sales' was created",
                link="/databases/sales",
                account=account,
            )

            assert Notification.objects(user=user).count() == 1
            notif = Notification.objects(user=user).first()
            assert notif.title == "New database"
            assert notif.notification_type == "database_created"
            assert notif.link == "/databases/sales"

    def test_no_notification_when_in_app_disabled(self, app, user, account):
        """When in_app is disabled for the category, no Notification is created."""
        with app.app_context():
            prefs = NotificationPreference(
                user=user,
                email_enabled=False,
                entry_modifications=NotificationChannel(in_app=False, email=False),
            )
            prefs.save()

            create_notification(
                recipient=user,
                notification_type="entry_created",
                title="New entry",
                message="An entry was created",
                account=account,
            )

            assert Notification.objects(user=user).count() == 0

    def test_email_disabled_globally(self, app, user, account):
        """When email_enabled is False globally, email should_notify returns False
        even if the per-category email flag is True."""
        with app.app_context():
            prefs = NotificationPreference(
                user=user,
                email_enabled=False,
                team_invites=NotificationChannel(in_app=True, email=True),
            )
            prefs.save()

            # Verify at the preference level that email is blocked
            assert prefs.should_notify("team_invite", "email") is False
            assert prefs.should_notify("team_invite", "in_app") is True


class TestNotifyAccountMembers:
    """Tests for notify_account_members function."""

    def test_sends_to_all_members_except_excluded(
        self, app, user, second_user, account, member_membership
    ):
        """Notifications are sent to all active members except the excluded user."""
        with app.app_context():
            # Ensure both users have default prefs that allow in_app for database_changes
            NotificationPreference(
                user=user,
                database_changes=NotificationChannel(in_app=True, email=False),
            ).save()
            NotificationPreference(
                user=second_user,
                database_changes=NotificationChannel(in_app=True, email=False),
            ).save()

            notify_account_members(
                account=account,
                notification_type="database_created",
                title="DB Created",
                message="A database was created",
                actor=user,
                exclude_user=user,
            )

            # Only second_user should have a notification (user is excluded)
            assert Notification.objects(user=user).count() == 0
            assert Notification.objects(user=second_user).count() == 1

    def test_respects_per_user_preferences(
        self, app, user, second_user, account, member_membership
    ):
        """Members who disabled in_app for the category do not receive notifications."""
        with app.app_context():
            # user: database_changes in_app ON
            NotificationPreference(
                user=user,
                database_changes=NotificationChannel(in_app=True, email=False),
            ).save()
            # second_user: database_changes in_app OFF
            NotificationPreference(
                user=second_user,
                database_changes=NotificationChannel(in_app=False, email=False),
            ).save()

            notify_account_members(
                account=account,
                notification_type="database_updated",
                title="DB Updated",
                message="A database was updated",
            )

            # user should get a notification, second_user should not
            assert Notification.objects(user=user).count() == 1
            assert Notification.objects(user=second_user).count() == 0


class TestSendEmailNotification:
    """Tests for send_email_notification function."""

    def test_no_mail_configured_does_not_raise(self, app, user):
        """When MAIL_USERNAME is empty, send_email_notification returns silently."""
        with app.app_context():
            app.config["MAIL_USERNAME"] = ""
            # This should not raise any exception
            send_email_notification(
                user=user,
                title="Test",
                message="Should not send",
                link="/test",
            )
