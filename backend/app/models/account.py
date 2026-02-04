"""Account model."""
import datetime
from app.extensions import db


class Account(db.Document):
    """Account/Organization document model."""

    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    updated_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    name = db.StringField(max_length=200, required=True)
    owner = db.ReferenceField(document_type="User", required=True)
    stripe_customer_id = db.StringField(unique=True, sparse=True)

    meta = {
        "collection": "accounts",
        "indexes": ["-created_at", "owner"],
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
            "name": self.name,
            "owner_id": str(self.owner.id) if self.owner else None,
            "stripe_customer_id": self.stripe_customer_id,
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
        }

    def __repr__(self) -> str:
        return f"<Account {self.name}>"
