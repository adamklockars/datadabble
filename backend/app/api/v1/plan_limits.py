"""Plan limit checking utilities and decorators."""
from functools import wraps
from flask import jsonify, current_app
from flask_jwt_extended import current_user

from app.models import (
    Database,
    Entry,
    Field,
    AccountMembership,
    Visualization,
    Subscription,
)


def get_account_plan(account):
    """Return 'pro' or 'free' based on the account's subscription status."""
    if account is None:
        return "free"
    try:
        sub = Subscription.objects(account=account).first()
    except Exception:
        return "free"
    if sub and sub.is_pro:
        return "pro"
    return "free"


def get_plan_limits(plan):
    """Return a dict of limits for the given plan. None means unlimited."""
    if plan == "pro":
        return {
            "max_databases": None,
            "max_entries_per_db": None,
            "max_fields_per_db": None,
            "max_members": None,
            "ai_queries_per_day": None,
            "max_visualizations": None,
        }
    return {
        "max_databases": current_app.config.get("FREE_TIER_MAX_DATABASES", 3),
        "max_entries_per_db": current_app.config.get("FREE_TIER_MAX_ENTRIES_PER_DB", 100),
        "max_fields_per_db": current_app.config.get("FREE_TIER_MAX_FIELDS_PER_DB", 10),
        "max_members": current_app.config.get("FREE_TIER_MAX_MEMBERS", 2),
        "ai_queries_per_day": current_app.config.get("FREE_TIER_AI_QUERIES_PER_DAY", 5),
        "max_visualizations": current_app.config.get("FREE_TIER_MAX_VISUALIZATIONS", 3),
    }


def get_account_usage(account):
    """Return current resource counts for the account."""
    from mongoengine import Q

    if account is None:
        return {
            "databases": 0,
            "members": 0,
            "visualizations": 0,
        }

    databases = Database.objects(account=account)
    db_count = databases.count()

    member_count = AccountMembership.objects(
        account=account, status__in=["active", "pending"]
    ).count()

    viz_count = Visualization.objects(
        user__in=[m.user for m in AccountMembership.objects(account=account)]
    ).count()

    return {
        "databases": db_count,
        "members": member_count,
        "visualizations": viz_count,
    }


def _get_entry_count_for_database(database):
    """Return the entry count for a specific database."""
    return Entry.objects(database=database).count()


def _get_field_count_for_database(database):
    """Return the field count for a specific database."""
    return Field.objects(database=database).count()


def check_plan_limit(resource_type):
    """
    Decorator that checks plan limits before allowing resource creation.

    Args:
        resource_type: One of 'database', 'entry', 'field', 'member', 'visualization'
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            account = current_user.active_account
            plan = get_account_plan(account)
            limits = get_plan_limits(plan)

            if resource_type == "database":
                limit = limits["max_databases"]
                if limit is not None:
                    usage = get_account_usage(account)
                    if usage["databases"] >= limit:
                        return jsonify({
                            "error": "Plan limit reached",
                            "limit_type": "database",
                            "limit": limit,
                            "current": usage["databases"],
                            "plan": plan,
                            "message": f"Free plan allows up to {limit} databases. Upgrade to Pro for unlimited databases.",
                        }), 403

            elif resource_type == "entry":
                # Need to get the database from the route kwargs
                slug = kwargs.get("slug")
                if slug and account:
                    from mongoengine import Q
                    database = Database.objects(
                        Q(account=account, slug=slug) |
                        Q(user=current_user, account=None, slug=slug)
                    ).first()
                    if database:
                        limit = limits["max_entries_per_db"]
                        if limit is not None:
                            count = _get_entry_count_for_database(database)
                            if count >= limit:
                                return jsonify({
                                    "error": "Plan limit reached",
                                    "limit_type": "entry",
                                    "limit": limit,
                                    "current": count,
                                    "plan": plan,
                                    "message": f"Free plan allows up to {limit} entries per database. Upgrade to Pro for unlimited entries.",
                                }), 403

            elif resource_type == "field":
                slug = kwargs.get("slug")
                if slug and account:
                    from mongoengine import Q
                    database = Database.objects(
                        Q(account=account, slug=slug) |
                        Q(user=current_user, account=None, slug=slug)
                    ).first()
                    if database:
                        limit = limits["max_fields_per_db"]
                        if limit is not None:
                            count = _get_field_count_for_database(database)
                            if count >= limit:
                                return jsonify({
                                    "error": "Plan limit reached",
                                    "limit_type": "field",
                                    "limit": limit,
                                    "current": count,
                                    "plan": plan,
                                    "message": f"Free plan allows up to {limit} fields per database. Upgrade to Pro for unlimited fields.",
                                }), 403

            elif resource_type == "member":
                limit = limits["max_members"]
                if limit is not None:
                    usage = get_account_usage(account)
                    if usage["members"] >= limit:
                        return jsonify({
                            "error": "Plan limit reached",
                            "limit_type": "member",
                            "limit": limit,
                            "current": usage["members"],
                            "plan": plan,
                            "message": f"Free plan allows up to {limit} team members. Upgrade to Pro for unlimited members.",
                        }), 403

            elif resource_type == "visualization":
                limit = limits["max_visualizations"]
                if limit is not None:
                    usage = get_account_usage(account)
                    if usage["visualizations"] >= limit:
                        return jsonify({
                            "error": "Plan limit reached",
                            "limit_type": "visualization",
                            "limit": limit,
                            "current": usage["visualizations"],
                            "plan": plan,
                            "message": f"Free plan allows up to {limit} visualizations. Upgrade to Pro for unlimited visualizations.",
                        }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator
