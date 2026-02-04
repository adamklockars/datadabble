"""Entry model."""
import datetime
from mongoengine import CASCADE
from app.extensions import db


class Entry(db.Document):
    """Entry document model - represents a data record in a database."""

    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    updated_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    database = db.ReferenceField(document_type="Database", reverse_delete_rule=CASCADE, required=True)
    values = db.DictField()

    meta = {
        "collection": "entries",
        "indexes": ["-created_at", "database"],
        "ordering": ["-created_at"],
    }

    def save(self, *args, **kwargs):
        """Update updated_at timestamp on save."""
        self.updated_at = datetime.datetime.utcnow()
        return super().save(*args, **kwargs)

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
            "database_id": str(self.database.id) if self.database else None,
            "values": self.values,
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
        }

    def __repr__(self) -> str:
        return f"<Entry {self.id}>"
