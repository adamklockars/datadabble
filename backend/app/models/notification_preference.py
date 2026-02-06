"""Notification preference model."""
import secrets
from app.extensions import db


class NotificationChannel(db.EmbeddedDocument):
    """Per-category notification channel toggles."""

    in_app = db.BooleanField(default=True)
    email = db.BooleanField(default=False)

    def to_dict(self) -> dict:
        return {
            "in_app": self.in_app,
            "email": self.email,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "NotificationChannel":
        return cls(
            in_app=data.get("in_app", True),
            email=data.get("email", False),
        )


class NotificationPreference(db.Document):
    """User notification preferences."""

    user = db.ReferenceField(document_type="User", required=True, unique=True)
    email_enabled = db.BooleanField(default=True)

    # Per-category channel settings
    team_invites = db.EmbeddedDocumentField(
        document_type=NotificationChannel,
        default=lambda: NotificationChannel(in_app=True, email=True),
    )
    database_changes = db.EmbeddedDocumentField(
        document_type=NotificationChannel,
        default=lambda: NotificationChannel(in_app=True, email=False),
    )
    entry_modifications = db.EmbeddedDocumentField(
        document_type=NotificationChannel,
        default=lambda: NotificationChannel(in_app=False, email=False),
    )
    field_changes = db.EmbeddedDocumentField(
        document_type=NotificationChannel,
        default=lambda: NotificationChannel(in_app=True, email=False),
    )

    weekly_digest = db.BooleanField(default=False)
    unsubscribe_token = db.StringField(
        max_length=100, default=lambda: secrets.token_urlsafe(32)
    )

    meta = {
        "collection": "notification_preferences",
        "indexes": ["user", "unsubscribe_token"],
    }

    # Map notification_type to preference category
    TYPE_TO_CATEGORY = {
        "team_invite": "team_invites",
        "team_invite_accepted": "team_invites",
        "member_role_changed": "team_invites",
        "database_created": "database_changes",
        "database_updated": "database_changes",
        "database_deleted": "database_changes",
        "entry_created": "entry_modifications",
        "entry_updated": "entry_modifications",
        "entry_deleted": "entry_modifications",
        "field_created": "field_changes",
        "field_updated": "field_changes",
        "field_deleted": "field_changes",
    }

    def should_notify(self, notification_type: str, channel: str) -> bool:
        """Check if user wants notifications for this type and channel."""
        if channel == "email" and not self.email_enabled:
            return False

        category = self.TYPE_TO_CATEGORY.get(notification_type)
        if not category:
            return channel == "in_app"  # Default: in-app only for unknown types

        channel_pref = getattr(self, category, None)
        if not channel_pref:
            return False

        return getattr(channel_pref, channel, False)

    def to_dict(self) -> dict:
        return {
            "email_enabled": self.email_enabled,
            "team_invites": self.team_invites.to_dict() if self.team_invites else {"in_app": True, "email": True},
            "database_changes": self.database_changes.to_dict() if self.database_changes else {"in_app": True, "email": False},
            "entry_modifications": self.entry_modifications.to_dict() if self.entry_modifications else {"in_app": False, "email": False},
            "field_changes": self.field_changes.to_dict() if self.field_changes else {"in_app": True, "email": False},
            "weekly_digest": self.weekly_digest,
        }

    @classmethod
    def get_or_create(cls, user):
        """Get existing preferences or create defaults."""
        pref = cls.objects(user=user).first()
        if not pref:
            pref = cls(user=user)
            pref.save()
        return pref
