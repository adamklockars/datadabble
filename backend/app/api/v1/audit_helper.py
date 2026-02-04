"""Helper functions for audit logging."""
from app.models import AuditLog


def log_action(
    database=None,
    user=None,
    action=None,
    resource_type=None,
    resource_id=None,
    resource_name=None,
    previous_state=None,
    new_state=None,
    changes=None,
    details=None,
    database_slug=None,  # Override for when database is being deleted
    account=None,  # Account reference for cross-database queries
):
    """Create an audit log entry."""
    # Determine database_slug
    if database_slug:
        slug = database_slug
    elif database:
        slug = database.slug
    else:
        slug = "deleted"

    # Determine account from database if not explicitly provided
    if account is None and database and hasattr(database, "account"):
        account = database.account

    audit_log = AuditLog(
        account=account,
        database=database,
        database_slug=slug,
        user=user,
        user_email=user.email if user else "unknown",
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        resource_name=resource_name,
        previous_state=previous_state,
        new_state=new_state,
        changes=changes,
        details=details,
    )
    audit_log.save()
    return audit_log


def compute_changes(previous_state, new_state):
    """Compute what changed between two states."""
    if not previous_state or not new_state:
        return None

    changes = {}
    all_keys = set(previous_state.keys()) | set(new_state.keys())

    for key in all_keys:
        old_val = previous_state.get(key)
        new_val = new_state.get(key)
        if old_val != new_val:
            changes[key] = {"from": old_val, "to": new_val}

    return changes if changes else None


def serialize_for_audit(obj, exclude_fields=None):
    """Serialize an object for audit log storage."""
    if obj is None:
        return None

    exclude_fields = exclude_fields or []

    if hasattr(obj, "to_dict"):
        data = obj.to_dict()
    elif isinstance(obj, dict):
        data = obj.copy()
    else:
        return str(obj)

    # Remove fields we don't want to store
    for field in exclude_fields:
        data.pop(field, None)

    # Remove timestamps from comparison (they always change)
    data.pop("created_at", None)
    data.pop("updated_at", None)

    return data
