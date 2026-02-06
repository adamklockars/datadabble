"""OAuth 2.0 Authorization Code model."""
import datetime
import secrets
from app.extensions import db


class OAuthAuthorizationCode(db.Document):
    """Temporary authorization code for OAuth 2.0 authorization code flow."""

    code = db.StringField(required=True, unique=True)
    client = db.ReferenceField(document_type="OAuthClient", required=True)
    user = db.ReferenceField(document_type="User", required=True)
    scopes = db.ListField(db.StringField(max_length=100))
    redirect_uri = db.StringField(max_length=2000, required=True)
    expires_at = db.DateTimeField(required=True)
    code_challenge = db.StringField(max_length=256)
    code_challenge_method = db.StringField(max_length=10, choices=[("S256", "S256"), ("plain", "plain")])
    used = db.BooleanField(default=False)

    meta = {
        "collection": "oauth_authorization_codes",
        "indexes": [
            "code",
            "client",
            {"fields": ["expires_at"], "expireAfterSeconds": 0},
        ],
    }

    @staticmethod
    def generate_code():
        """Generate a random authorization code."""
        return secrets.token_urlsafe(32)

    def is_expired(self):
        """Check if the authorization code has expired."""
        return datetime.datetime.utcnow() > self.expires_at

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
            "code": self.code,
            "client_id": str(self.client.id) if self.client else None,
            "user_id": str(self.user.id) if self.user else None,
            "scopes": self.scopes or [],
            "redirect_uri": self.redirect_uri,
            "expires_at": format_datetime(self.expires_at),
            "used": self.used,
        }

    def __repr__(self):
        return f"<OAuthAuthorizationCode {self.code[:8]}...>"
