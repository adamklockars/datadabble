"""Utility decorators."""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import current_user

from app.models import Database


def get_database_or_404(slug):
    """Get database owned by current user or return None."""
    return Database.objects(user=current_user, slug=slug).first()


def database_required(f):
    """Decorator that ensures database exists and belongs to current user."""
    @wraps(f)
    def decorated_function(slug, *args, **kwargs):
        database = get_database_or_404(slug)
        if not database:
            return jsonify({"error": "Database not found"}), 404
        return f(slug, database=database, *args, **kwargs)
    return decorated_function
