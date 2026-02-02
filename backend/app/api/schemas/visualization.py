"""Visualization schemas for validation and serialization."""
from marshmallow import Schema, fields, validate


class VisualizationSchema(Schema):
    """Schema for visualization output."""

    id = fields.Str(dump_only=True)
    title = fields.Str(required=True)
    chart_type = fields.Str(required=True)
    database_slugs = fields.List(fields.Str(), required=True)
    x_field = fields.Str(required=True)
    y_field = fields.Str(allow_none=True)
    aggregation = fields.Str()
    created_at = fields.Str(dump_only=True)
    updated_at = fields.Str(dump_only=True)


class VisualizationCreateSchema(Schema):
    """Schema for creating a visualization."""

    title = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=120),
    )
    chart_type = fields.Str(
        required=True,
        validate=validate.OneOf(["bar", "line", "pie"]),
    )
    database_slugs = fields.List(
        fields.Str(validate=validate.Length(min=1, max=120)),
        required=True,
        validate=validate.Length(min=1),
    )
    x_field = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=120),
    )
    y_field = fields.Str(validate=validate.Length(max=120))
    aggregation = fields.Str(
        load_default="count",
        validate=validate.OneOf(["count", "sum"]),
    )


class VisualizationUpdateSchema(Schema):
    """Schema for updating a visualization."""

    title = fields.Str(validate=validate.Length(min=1, max=120))
    chart_type = fields.Str(validate=validate.OneOf(["bar", "line", "pie"]))
    database_slugs = fields.List(
        fields.Str(validate=validate.Length(min=1, max=120)),
        validate=validate.Length(min=1),
    )
    x_field = fields.Str(validate=validate.Length(min=1, max=120))
    y_field = fields.Str(validate=validate.Length(max=120))
    aggregation = fields.Str(validate=validate.OneOf(["count", "sum"]))
