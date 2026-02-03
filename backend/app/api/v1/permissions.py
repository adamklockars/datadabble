"""Permission checking utilities and decorators."""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from app.models import User, AccountMembership


def get_current_user():
    """Get the current authenticated user."""
    user_id = get_jwt_identity()
    return User.objects(id=user_id).first()


def get_user_membership(user, account=None):
    """Get user's membership for their active account or specified account."""
    if account is None:
        account = user.active_account
    if account is None:
        return None
    return AccountMembership.objects(user=user, account=account, status="active").first()


def check_permission(resource_type: str, action: str):
    """
    Decorator to check if user has permission for a resource action.

    Args:
        resource_type: One of 'database', 'field', 'entry', 'user'
        action: One of 'create', 'read', 'update', 'delete'
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({"error": "User not found"}), 404

            # If user has no active account, allow all operations (legacy mode)
            if not user.active_account:
                return f(*args, **kwargs)

            membership = get_user_membership(user)
            if not membership:
                return jsonify({"error": "No active membership found"}), 403

            if not membership.has_permission(resource_type, action):
                return jsonify({
                    "error": f"Permission denied: cannot {action} {resource_type}"
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_admin():
    """Decorator to require admin role."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({"error": "User not found"}), 404

            if not user.active_account:
                return jsonify({"error": "No active account"}), 403

            membership = get_user_membership(user)
            if not membership or membership.role != "admin":
                return jsonify({"error": "Admin access required"}), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def is_account_admin(user, account=None):
    """Check if user is admin of their active account or specified account."""
    if account is None:
        account = user.active_account
    if account is None:
        return False

    membership = AccountMembership.objects(user=user, account=account, status="active").first()
    return membership and membership.role == "admin"
