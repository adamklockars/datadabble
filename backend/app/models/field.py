"""Field model."""
import datetime
from mongoengine import CASCADE
from app.extensions import db


FIELD_TYPES = (
    ("BOOL", "Boolean"),
    ("INT", "Integer"),
    ("DEC", "Decimal"),
    ("STR", "String"),
    ("DATE", "Date"),
    ("EMAIL", "Email"),
    ("URL", "URL"),
    ("DICT", "Dictionary"),
    ("LIST", "List"),
)


class Field(db.Document):
    """Field document model - represents a field definition in a database."""

    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    updated_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    database = db.ReferenceField(document_type="Database", reverse_delete_rule=CASCADE, required=True)
    name = db.StringField(max_length=120, required=True)
    field_type = db.StringField(max_length=5, choices=FIELD_TYPES, required=True)
    required = db.BooleanField(default=False)
    default_value = db.DynamicField()
    order = db.IntField(default=0)

    meta = {
        "collection": "fields",
        "indexes": ["-created_at", "database", {"fields": ["database", "name"], "unique": True}],
        "ordering": ["order", "-created_at"],
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
            "name": self.name,
            "field_type": self.field_type,
            "required": self.required,
            "default_value": self.default_value,
            "order": self.order,
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
        }

    def __repr__(self) -> str:
        return f"<Field {self.name} ({self.field_type})>"
