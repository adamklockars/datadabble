"""Subscription model for Stripe billing."""
import datetime
from app.extensions import db


SUBSCRIPTION_STATUSES = (
    "active",
    "past_due",
    "canceled",
    "incomplete",
    "trialing",
    "unpaid",
    "paused",
)


class Subscription(db.Document):
    """Stripe subscription document model."""

    account = db.ReferenceField(
        document_type="Account", unique=True, reverse_delete_rule=db.CASCADE
    )
    stripe_subscription_id = db.StringField(unique=True, sparse=True)
    stripe_price_id = db.StringField()
    status = db.StringField(choices=SUBSCRIPTION_STATUSES, default="incomplete")
    current_period_start = db.DateTimeField()
    current_period_end = db.DateTimeField()
    cancel_at_period_end = db.BooleanField(default=False)
    canceled_at = db.DateTimeField()
    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    updated_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)

    meta = {
        "collection": "subscriptions",
        "indexes": ["account", "stripe_subscription_id", "status"],
    }

    def save(self, *args, **kwargs):
        """Update updated_at timestamp on save."""
        self.updated_at = datetime.datetime.utcnow()
        return super().save(*args, **kwargs)

    @property
    def is_pro(self):
        """Check if subscription grants pro access."""
        return self.status in ("active", "trialing", "past_due")

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
            "account_id": str(self.account.id) if self.account else None,
            "stripe_subscription_id": self.stripe_subscription_id,
            "stripe_price_id": self.stripe_price_id,
            "status": self.status,
            "current_period_start": format_datetime(self.current_period_start),
            "current_period_end": format_datetime(self.current_period_end),
            "cancel_at_period_end": self.cancel_at_period_end,
            "canceled_at": format_datetime(self.canceled_at),
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
            "is_pro": self.is_pro,
        }

    def __repr__(self) -> str:
        return f"<Subscription {self.status} for account={self.account}>"
