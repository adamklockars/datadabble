"""User model."""
import datetime
import bcrypt
import mongoengine
from app.extensions import db


class User(db.Document):
    """User document model."""

    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    updated_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    email = db.StringField(required=True, unique=True)
    first_name = db.StringField(max_length=50)
    last_name = db.StringField(max_length=50)
    password_hash = db.StringField(required=True)
    social_accounts = mongoengine.ListField(mongoengine.EmbeddedDocumentField("SocialAccount"))
    # Current active account (for users with multiple account memberships)
    active_account = db.ReferenceField(document_type="Account")

    meta = {
        "collection": "users",
        "indexes": ["email", "-created_at", "active_account"],
        "ordering": ["-created_at"],
    }

    def set_password(self, password: str) -> None:
        """Hash and set password."""
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    def check_password(self, password: str) -> bool:
        """Verify password against hash."""
        # Social-only or pending users cannot log in with password
        if self.password_hash in ("social_auth_only", "pending"):
            return False
        try:
            return bcrypt.checkpw(
                password.encode("utf-8"), self.password_hash.encode("utf-8")
            )
        except (ValueError, TypeError):
            return False

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
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "active_account_id": str(self.active_account.id) if self.active_account else None,
            "social_accounts": [sa.to_dict() for sa in (self.social_accounts or [])],
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
        }

    def __repr__(self) -> str:
        return f"<User {self.email}>"
