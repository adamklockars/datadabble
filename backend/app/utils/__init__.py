"""Utility functions and decorators."""
from app.utils.errors import register_error_handlers
from app.utils.decorators import get_database_or_404

__all__ = ["register_error_handlers", "get_database_or_404"]
