"""Audit log model."""
import datetime
from mongoengine import CASCADE
from app.extensions import db


ACTION_TYPES = (
    ("DATABASE_CREATED", "Database Created"),
    ("DATABASE_UPDATED", "Database Updated"),
    ("DATABASE_DELETED", "Database Deleted"),
    ("FIELD_CREATED", "Field Created"),
    ("FIELD_UPDATED", "Field Updated"),
    ("FIELD_DELETED", "Field Deleted"),
    ("FIELD_REORDERED", "Fields Reordered"),
    ("ENTRY_CREATED", "Entry Created"),
    ("ENTRY_UPDATED", "Entry Updated"),
    ("ENTRY_DELETED", "Entry Deleted"),
)


class AuditLog(db.Document):
    """Audit log document model - tracks all changes to databases."""

    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    database = db.ReferenceField(
        document_type="Database",
        reverse_delete_rule=CASCADE,
        required=False  # Can be null if database was deleted
    )
    database_slug = db.StringField(max_length=200, required=True)  # Keep even if DB deleted
    user = db.ReferenceField(document_type="User", required=False)  # Can be null if user deleted
    user_email = db.StringField(max_length=200, required=True)  # Keep even if user deleted
    action = db.StringField(max_length=50, choices=ACTION_TYPES, required=True)
    resource_type = db.StringField(max_length=50, required=True)  # database, field, entry
    resource_id = db.StringField(max_length=100)  # ID of affected resource
    resource_name = db.StringField(max_length=200)  # Name/title for readability
    previous_state = db.DictField()  # State before change
    new_state = db.DictField()  # State after change
    changes = db.DictField()  # Summary of what changed
    details = db.StringField(max_length=1000)  # Human-readable description

    meta = {
        "collection": "audit_logs",
        "indexes": [
            "-created_at",
            "database",
            "database_slug",
            "user",
            "action",
            {"fields": ["database_slug", "-created_at"]},
        ],
        "ordering": ["-created_at"],
    }

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        def format_datetime(dt):
            if dt is None:
                return None
            if isinstance(dt, str):
                return dt
            return dt.isoformat()

        return {
            "id": str(self.id),
            "created_at": format_datetime(self.created_at),
            "database_id": str(self.database.id) if self.database else None,
            "database_slug": self.database_slug,
            "user_id": str(self.user.id) if self.user else None,
            "user_email": self.user_email,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "resource_name": self.resource_name,
            "previous_state": self.previous_state,
            "new_state": self.new_state,
            "changes": self.changes,
            "details": self.details,
        }

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} by {self.user_email}>"
