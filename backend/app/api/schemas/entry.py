"""Entry schemas for validation and serialization."""
from marshmallow import Schema, fields


class EntrySchema(Schema):
    """Schema for entry output."""

    id = fields.Str(dump_only=True)
    database_id = fields.Str(dump_only=True)
    values = fields.Dict()
    created_at = fields.Str(dump_only=True)
    updated_at = fields.Str(dump_only=True)


class EntryCreateSchema(Schema):
    """Schema for entry creation."""

    values = fields.Dict(required=True)


class EntryUpdateSchema(Schema):
    """Schema for entry update."""

    values = fields.Dict(required=True)
