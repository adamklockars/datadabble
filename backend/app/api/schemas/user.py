"""User schemas for validation and serialization."""
from marshmallow import Schema, fields, validate


class UserSchema(Schema):
    """Schema for user output."""

    id = fields.Str(dump_only=True)
    email = fields.Email(required=True)
    first_name = fields.Str()
    last_name = fields.Str()
    created_at = fields.Str(dump_only=True)
    updated_at = fields.Str(dump_only=True)


class UserCreateSchema(Schema):
    """Schema for user registration."""

    email = fields.Email(required=True)
    password = fields.Str(
        required=True,
        validate=validate.Length(min=8, max=128),
        load_only=True,
    )
    first_name = fields.Str(validate=validate.Length(max=50))
    last_name = fields.Str(validate=validate.Length(max=50))


class UserLoginSchema(Schema):
    """Schema for user login."""

    email = fields.Email(required=True)
    password = fields.Str(required=True, load_only=True)
