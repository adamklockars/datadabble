"""Database model."""
import datetime
import re
from mongoengine import CASCADE
from app.extensions import db


class Database(db.Document):
    """Database document model - represents a user-defined database."""

    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    updated_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    title = db.StringField(max_length=120, required=True)
    slug = db.StringField(max_length=120, required=True)
    description = db.StringField(max_length=500)
    # Keep user for backwards compatibility and to track creator
    user = db.ReferenceField(document_type="User", reverse_delete_rule=CASCADE, required=True)
    # Account that owns this database (for multi-user access)
    account = db.ReferenceField(document_type="Account", reverse_delete_rule=CASCADE)

    meta = {
        "collection": "databases",
        "allow_inheritance": True,
        "indexes": [
            "-created_at",
            "slug",
            "account",
            {"fields": ["user", "slug"], "unique": True},
            {"fields": ["account", "slug"], "unique": True, "sparse": True},
        ],
        "ordering": ["-created_at"],
    }

    @staticmethod
    def generate_slug(title: str) -> str:
        """Generate URL-friendly slug from title."""
        slug = title.lower().strip()
        slug = re.sub(r"[^\w\s-]", "", slug)
        slug = re.sub(r"[-\s]+", "-", slug)
        return slug

    def save(self, *args, **kwargs):
        """Update updated_at timestamp and generate slug on save."""
        self.updated_at = datetime.datetime.utcnow()
        if not self.slug:
            self.slug = self.generate_slug(self.title)
        return super().save(*args, **kwargs)

    def to_dict(self, include_fields: bool = False) -> dict:
        """Convert to dictionary for JSON serialization."""
        from app.models import Field

        def format_datetime(dt):
            if dt is None:
                return None
            if isinstance(dt, str):
                return dt
            return dt.isoformat()

        data = {
            "id": str(self.id),
            "title": self.title,
            "slug": self.slug,
            "description": self.description,
            "user_id": str(self.user.id) if self.user else None,
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
        }

        if include_fields:
            fields = Field.objects(database=self)
            data["fields"] = [f.to_dict() for f in fields]

        return data

    def __repr__(self) -> str:
        return f"<Database {self.title}>"
