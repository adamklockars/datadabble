"""Database schemas for validation and serialization."""
from marshmallow import Schema, fields, validate
from marshmallow import fields as ma_fields


class DatabaseSchema(Schema):
    """Schema for database output."""

    id = ma_fields.Str(dump_only=True)
    title = ma_fields.Str(required=True)
    slug = ma_fields.Str(dump_only=True)
    description = ma_fields.Str()
    user_id = ma_fields.Str(dump_only=True)
    fields = ma_fields.List(ma_fields.Nested("FieldSchema"), dump_only=True)
    created_at = ma_fields.Str(dump_only=True)
    updated_at = ma_fields.Str(dump_only=True)


class DatabaseCreateSchema(Schema):
    """Schema for database creation."""

    title = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=120),
    )
    description = fields.Str(validate=validate.Length(max=500))


class DatabaseUpdateSchema(Schema):
    """Schema for database update."""

    title = fields.Str(validate=validate.Length(min=1, max=120))
    description = fields.Str(validate=validate.Length(max=500))
