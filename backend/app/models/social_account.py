"""Social account embedded document for OAuth providers."""
import datetime
from app.extensions import db


class SocialAccount(db.EmbeddedDocument):
    """Embedded document linking a user to a social login provider."""

    provider = db.StringField(
        max_length=20,
        choices=[("google", "Google"), ("github", "GitHub")],
        required=True,
    )
    provider_user_id = db.StringField(max_length=200, required=True)
    email = db.StringField(max_length=200)
    name = db.StringField(max_length=200)
    avatar_url = db.StringField(max_length=500)
    connected_at = db.DateTimeField(default=datetime.datetime.utcnow)

    def to_dict(self) -> dict:
        def format_datetime(dt):
            if dt is None:
                return None
            if isinstance(dt, str):
                return dt
            return dt.isoformat()

        return {
            "provider": self.provider,
            "provider_user_id": self.provider_user_id,
            "email": self.email,
            "name": self.name,
            "avatar_url": self.avatar_url,
            "connected_at": format_datetime(self.connected_at),
        }
