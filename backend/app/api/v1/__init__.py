"""API v1 blueprint."""
from flask import Blueprint

api_v1 = Blueprint("api_v1", __name__)

from app.api.v1 import auth, databases, fields, entries, ai, audit, visualizations, oauth, notifications  # noqa: E402, F401
