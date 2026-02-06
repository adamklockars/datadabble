"""OAuth 2.0 Client model."""
import datetime
import uuid
import secrets
import bcrypt
from app.extensions import db


class OAuthClient(db.Document):
    """OAuth 2.0 client application registration."""

    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    updated_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    client_id = db.StringField(required=True, unique=True)
    client_secret_hash = db.StringField(required=True)
    name = db.StringField(max_length=200, required=True)
    description = db.StringField(max_length=1000)
    redirect_uris = db.ListField(db.StringField(max_length=2000))
    scopes = db.ListField(db.StringField(max_length=100))
    user = db.ReferenceField(document_type="User", required=True)
    account = db.ReferenceField(document_type="Account")
    active = db.BooleanField(default=True)

    meta = {
        "collection": "oauth_clients",
        "indexes": [
            "client_id",
            "user",
            "account",
            "-created_at",
        ],
        "ordering": ["-created_at"],
    }

    @staticmethod
    def generate_client_id():
        """Generate a unique client ID."""
        return str(uuid.uuid4())

    @staticmethod
    def generate_client_secret():
        """Generate a random client secret."""
        return secrets.token_urlsafe(48)

    def set_secret(self, secret):
        """Hash and store client secret."""
        salt = bcrypt.gensalt()
        self.client_secret_hash = bcrypt.hashpw(
            secret.encode("utf-8"), salt
        ).decode("utf-8")

    def check_secret(self, secret):
        """Verify client secret against hash."""
        try:
            return bcrypt.checkpw(
                secret.encode("utf-8"),
                self.client_secret_hash.encode("utf-8"),
            )
        except (ValueError, TypeError):
            return False

    def save(self, *args, **kwargs):
        """Update updated_at timestamp on save."""
        self.updated_at = datetime.datetime.utcnow()
        if not self.client_id:
            self.client_id = self.generate_client_id()
        return super().save(*args, **kwargs)

    def to_dict(self):
        """Convert to dictionary for JSON serialization."""
        def format_datetime(dt):
            if dt is None:
                return None
            if isinstance(dt, str):
                return dt
            return dt.isoformat()

        return {
            "id": str(self.id),
            "client_id": self.client_id,
            "name": self.name,
            "description": self.description,
            "redirect_uris": self.redirect_uris or [],
            "scopes": self.scopes or [],
            "active": self.active,
            "user_id": str(self.user.id) if self.user else None,
            "account_id": str(self.account.id) if self.account else None,
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
        }

    def __repr__(self):
        return f"<OAuthClient {self.name} ({self.client_id})>"
