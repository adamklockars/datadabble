"""Notification model."""
import datetime
from app.extensions import db


NOTIFICATION_TYPES = (
    ("team_invite", "Team Invite"),
    ("team_invite_accepted", "Team Invite Accepted"),
    ("database_created", "Database Created"),
    ("database_updated", "Database Updated"),
    ("database_deleted", "Database Deleted"),
    ("entry_created", "Entry Created"),
    ("entry_updated", "Entry Updated"),
    ("entry_deleted", "Entry Deleted"),
    ("field_created", "Field Created"),
    ("field_updated", "Field Updated"),
    ("field_deleted", "Field Deleted"),
    ("member_role_changed", "Member Role Changed"),
)


class Notification(db.Document):
    """In-app notification document."""

    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    user = db.ReferenceField(document_type="User", required=True)  # Recipient
    account = db.ReferenceField(document_type="Account")
    notification_type = db.StringField(
        max_length=50, choices=NOTIFICATION_TYPES, required=True
    )
    title = db.StringField(max_length=200, required=True)
    message = db.StringField(max_length=1000)
    link = db.StringField(max_length=500)  # Frontend route to navigate to
    read = db.BooleanField(default=False)
    read_at = db.DateTimeField()
    actor_email = db.StringField(max_length=200)  # Who triggered the notification
    database_slug = db.StringField(max_length=200)
    resource_type = db.StringField(max_length=50)
    resource_id = db.StringField(max_length=100)

    meta = {
        "collection": "notifications",
        "indexes": [
            {"fields": ["user", "-created_at"]},
            {"fields": ["user", "read"]},
            "-created_at",
        ],
        "ordering": ["-created_at"],
    }

    def to_dict(self) -> dict:
        def format_datetime(dt):
            if dt is None:
                return None
            if isinstance(dt, str):
                return dt
            return dt.isoformat()

        return {
            "id": str(self.id),
            "created_at": format_datetime(self.created_at),
            "notification_type": self.notification_type,
            "title": self.title,
            "message": self.message,
            "link": self.link,
            "read": self.read,
            "read_at": format_datetime(self.read_at),
            "actor_email": self.actor_email,
            "database_slug": self.database_slug,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
        }

    def __repr__(self) -> str:
        return f"<Notification {self.notification_type} for {self.user.email if self.user else 'unknown'}>"
