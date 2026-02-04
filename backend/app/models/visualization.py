"""Visualization model."""
import datetime
from mongoengine import CASCADE
from app.extensions import db


CHART_TYPES = (
    ("bar", "Bar"),
    ("line", "Line"),
    ("pie", "Pie"),
)

AGGREGATIONS = (
    ("count", "Count"),
    ("sum", "Sum"),
)


class Visualization(db.Document):
    """Saved visualization config - chart type, database(s), and field mapping."""

    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    updated_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    user = db.ReferenceField(document_type="User", reverse_delete_rule=CASCADE, required=True)
    title = db.StringField(max_length=120, required=True)
    chart_type = db.StringField(max_length=10, choices=CHART_TYPES, required=True)
    database_slugs = db.ListField(field=db.StringField(max_length=120), required=True)
    x_field = db.StringField(max_length=120, required=True)
    y_field = db.StringField(max_length=120)
    aggregation = db.StringField(max_length=10, choices=AGGREGATIONS, default="count")

    meta = {
        "collection": "visualizations",
        "indexes": ["-created_at", "user"],
        "ordering": ["-created_at"],
    }

    def save(self, *args, **kwargs):
        """Update updated_at on save."""
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
            "title": self.title,
            "chart_type": self.chart_type,
            "database_slugs": self.database_slugs,
            "x_field": self.x_field,
            "y_field": self.y_field or None,
            "aggregation": self.aggregation,
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
        }

    def __repr__(self) -> str:
        return f"<Visualization {self.title}>"
