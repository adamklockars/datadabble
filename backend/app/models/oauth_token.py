"""OAuth 2.0 Token model."""
import datetime
import secrets
import hashlib
from app.extensions import db


class OAuthToken(db.Document):
    """Issued OAuth 2.0 access and refresh tokens."""

    access_token = db.StringField(required=True, unique=True)
    refresh_token = db.StringField(unique=True, sparse=True)
    client = db.ReferenceField(document_type="OAuthClient", required=True)
    user = db.ReferenceField(document_type="User", required=True)
    scopes = db.ListField(db.StringField(max_length=100))
    expires_at = db.DateTimeField(required=True)
    revoked = db.BooleanField(default=False)
    created_at = db.DateTimeField(default=datetime.datetime.utcnow)

    meta = {
        "collection": "oauth_tokens",
        "indexes": [
            "access_token",
            "refresh_token",
            "client",
            "user",
            "-created_at",
        ],
    }

    @staticmethod
    def generate_token():
        """Generate a random token string."""
        return secrets.token_urlsafe(48)

    @staticmethod
    def hash_token(token):
        """Hash a token for storage."""
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def is_expired(self):
        """Check if the token has expired."""
        return datetime.datetime.utcnow() > self.expires_at

    def is_valid(self):
        """Check if the token is valid (not expired and not revoked)."""
        return not self.revoked and not self.is_expired()

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
            "client_id": str(self.client.id) if self.client else None,
            "user_id": str(self.user.id) if self.user else None,
            "scopes": self.scopes or [],
            "expires_at": format_datetime(self.expires_at),
            "revoked": self.revoked,
            "created_at": format_datetime(self.created_at),
        }

    def __repr__(self):
        return f"<OAuthToken {self.access_token[:8]}...>"
