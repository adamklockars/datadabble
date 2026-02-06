"""OAuth 2.0 scope definitions and enforcement."""
from functools import wraps
from flask import jsonify, g


SCOPES = {
    "read:user": "Read your profile information",
    "read:databases": "List and read your databases",
    "write:databases": "Create, update, and delete databases",
    "read:fields": "Read field definitions",
    "write:fields": "Create, update, and delete fields",
    "read:entries": "Read database entries",
    "write:entries": "Create, update, and delete entries",
    "read:visualizations": "Read visualizations",
    "write:visualizations": "Create, update, and delete visualizations",
}


def require_scope(scope):
    """Decorator to enforce OAuth scope on an endpoint.

    No-op for JWT-authenticated requests (regular users).
    Only enforced for OAuth token-authenticated requests.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token_scopes = getattr(g, "oauth_scopes", None)
            if token_scopes is not None:
                if scope not in token_scopes:
                    return jsonify({
                        "error": "Insufficient scope",
                        "required_scope": scope,
                    }), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator
