"""Field schemas for validation and serialization."""
from marshmallow import Schema, fields, validate

from app.models.field import FIELD_TYPES

VALID_FIELD_TYPES = [t[0] for t in FIELD_TYPES]


class FieldSchema(Schema):
    """Schema for field output."""

    id = fields.Str(dump_only=True)
    database_id = fields.Str(dump_only=True)
    name = fields.Str(required=True)
    field_type = fields.Str(required=True)
    required = fields.Bool()
    default_value = fields.Raw()
    order = fields.Int()
    created_at = fields.Str(dump_only=True)
    updated_at = fields.Str(dump_only=True)


class FieldCreateSchema(Schema):
    """Schema for field creation."""

    name = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=120),
    )
    field_type = fields.Str(
        required=True,
        validate=validate.OneOf(VALID_FIELD_TYPES),
    )
    required = fields.Bool(load_default=False)
    default_value = fields.Raw()
    order = fields.Int(load_default=0)


class FieldUpdateSchema(Schema):
    """Schema for field update."""

    name = fields.Str(validate=validate.Length(min=1, max=120))
    field_type = fields.Str(validate=validate.OneOf(VALID_FIELD_TYPES))
    required = fields.Bool()
    default_value = fields.Raw()
    order = fields.Int()
