"""Entry CRUD endpoints."""
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError
from bson import ObjectId
from bson.errors import InvalidId
from mongoengine import Q

from app.api.v1 import api_v1
from app.api.schemas import EntrySchema, EntryCreateSchema, EntryUpdateSchema
from app.models import Database, Entry, Field
from app.api.v1.audit_helper import log_action, compute_changes, serialize_for_audit
from app.api.v1.permissions import check_permission
from app.api.v1.filter_parser import parse_filter, ast_to_mongo_query, FilterParseError
from app.api.v1.notification_service import notify_account_members
from app.api.v1.plan_limits import check_plan_limit


def get_database_or_404(slug):
    """Get database owned by current user or account, or return None."""
    if current_user.active_account:
        database = Database.objects(
            Q(account=current_user.active_account, slug=slug) |
            Q(user=current_user, account=None, slug=slug)
        ).first()
    else:
        database = Database.objects(user=current_user, slug=slug).first()
    return database


@api_v1.route("/databases/<slug>/entries", methods=["GET"])
@jwt_required()
def list_entries(slug):
    """List entries for a database with pagination and filtering."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    # Pagination parameters
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    per_page = min(per_page, 100)  # Max 100 per page

    # Filter expression
    filter_expr = request.args.get("filter", "").strip()

    # Build base query
    base_query = {"database": database}

    # Apply filter if provided
    if filter_expr:
        try:
            # Get field types for proper value conversion
            fields = Field.objects(database=database)
            field_types = {f.name: f.field_type for f in fields}

            ast = parse_filter(filter_expr)
            filter_query = ast_to_mongo_query(ast, field_types)

            if filter_query:
                # Use raw query with __raw__ for complex MongoDB queries
                entries_query = Entry.objects(database=database).filter(__raw__=filter_query)
            else:
                entries_query = Entry.objects(database=database)
        except FilterParseError as e:
            return jsonify({"error": f"Invalid filter: {str(e)}"}), 400
    else:
        entries_query = Entry.objects(database=database)

    # Get total count (with filter applied)
    total = entries_query.count()

    # Get paginated entries
    skip = (page - 1) * per_page
    entries = entries_query.skip(skip).limit(per_page)

    return jsonify({
        "entries": [EntrySchema().dump(e.to_dict()) for e in entries],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
        },
        "filter": filter_expr if filter_expr else None,
    }), 200


@api_v1.route("/databases/<slug>/entries/validate-filter", methods=["POST"])
@jwt_required()
def validate_filter(slug):
    """Validate a filter expression without executing it."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    data = request.get_json() or {}
    filter_expr = data.get("filter", "").strip()

    if not filter_expr:
        return jsonify({"valid": True, "ast": {"type": "empty"}}), 200

    try:
        ast = parse_filter(filter_expr)
        return jsonify({"valid": True, "ast": ast}), 200
    except FilterParseError as e:
        return jsonify({"valid": False, "error": str(e)}), 200


@api_v1.route("/databases/<slug>/entries", methods=["POST"])
@jwt_required()
@check_permission("entry", "create")
@check_plan_limit("entry")
def create_entry(slug):
    """Create a new entry in a database."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    schema = EntryCreateSchema()

    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    entry = Entry(
        database=database,
        values=data["values"],
    )
    entry.save()

    # Audit log
    log_action(
        database=database,
        user=current_user,
        action="ENTRY_CREATED",
        resource_type="entry",
        resource_id=entry.id,
        new_state={"values": entry.values},
        details=f"Created entry with {len(entry.values)} values",
    )

    # Notify account members (entry notifications are opt-in)
    if database.account:
        notify_account_members(
            account=database.account,
            notification_type="entry_created",
            title=f"New entry in {database.title}",
            message=f"{current_user.email} added an entry to '{database.title}'",
            link=f"/databases/{database.slug}",
            actor=current_user,
            exclude_user=current_user,
            database_slug=database.slug,
            resource_type="entry",
            resource_id=entry.id,
        )

    return jsonify({
        "message": "Entry created successfully",
        "entry": EntrySchema().dump(entry.to_dict()),
    }), 201


@api_v1.route("/databases/<slug>/entries/<entry_id>", methods=["GET"])
@jwt_required()
def get_entry(slug, entry_id):
    """Get a specific entry."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    try:
        entry = Entry.objects(database=database, id=ObjectId(entry_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid entry ID"}), 400

    if not entry:
        return jsonify({"error": "Entry not found"}), 404

    return jsonify(EntrySchema().dump(entry.to_dict())), 200


@api_v1.route("/databases/<slug>/entries/<entry_id>", methods=["PUT"])
@jwt_required()
@check_permission("entry", "update")
def update_entry(slug, entry_id):
    """Update an entry."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    try:
        entry = Entry.objects(database=database, id=ObjectId(entry_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid entry ID"}), 400

    if not entry:
        return jsonify({"error": "Entry not found"}), 404

    # Capture previous state for audit
    previous_values = dict(entry.values) if entry.values else {}

    schema = EntryUpdateSchema()

    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    entry.values = data["values"]
    entry.save()

    # Audit log
    new_values = dict(entry.values) if entry.values else {}
    changes = compute_changes({"values": previous_values}, {"values": new_values})
    log_action(
        database=database,
        user=current_user,
        action="ENTRY_UPDATED",
        resource_type="entry",
        resource_id=entry.id,
        previous_state={"values": previous_values},
        new_state={"values": new_values},
        changes=changes,
        details=f"Updated entry",
    )

    if database.account:
        notify_account_members(
            account=database.account,
            notification_type="entry_updated",
            title=f"Entry updated in {database.title}",
            message=f"{current_user.email} updated an entry in '{database.title}'",
            link=f"/databases/{database.slug}",
            actor=current_user,
            exclude_user=current_user,
            database_slug=database.slug,
            resource_type="entry",
            resource_id=entry.id,
        )

    return jsonify({
        "message": "Entry updated successfully",
        "entry": EntrySchema().dump(entry.to_dict()),
    }), 200


@api_v1.route("/databases/<slug>/entries/<entry_id>", methods=["DELETE"])
@jwt_required()
@check_permission("entry", "delete")
def delete_entry(slug, entry_id):
    """Delete an entry."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    try:
        entry = Entry.objects(database=database, id=ObjectId(entry_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid entry ID"}), 400

    if not entry:
        return jsonify({"error": "Entry not found"}), 404

    # Capture state for audit
    previous_values = dict(entry.values) if entry.values else {}
    entry_id_str = str(entry.id)

    # Audit log before deletion
    log_action(
        database=database,
        user=current_user,
        action="ENTRY_DELETED",
        resource_type="entry",
        resource_id=entry_id_str,
        previous_state={"values": previous_values},
        details=f"Deleted entry",
    )

    if database.account:
        notify_account_members(
            account=database.account,
            notification_type="entry_deleted",
            title=f"Entry deleted from {database.title}",
            message=f"{current_user.email} deleted an entry from '{database.title}'",
            link=f"/databases/{database.slug}",
            actor=current_user,
            exclude_user=current_user,
            database_slug=database.slug,
            resource_type="entry",
            resource_id=entry_id_str,
        )

    entry.delete()

    return jsonify({"message": "Entry deleted successfully"}), 200
