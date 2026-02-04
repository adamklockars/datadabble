"""Database CRUD endpoints."""
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError
from mongoengine import Q

from app.api.v1 import api_v1
from app.api.schemas import DatabaseSchema, DatabaseCreateSchema, DatabaseUpdateSchema
from app.models import Database, Field, Entry
from app.api.v1.audit_helper import log_action, compute_changes, serialize_for_audit
from app.api.v1.permissions import check_permission
from app.api.v1.notification_service import notify_account_members
from app.api.v1.plan_limits import check_plan_limit


@api_v1.route("/databases", methods=["GET"])
@jwt_required()
def list_databases():
    """List all databases for current user or account."""
    # If user has an active account, show databases from that account
    if current_user.active_account:
        databases = Database.objects(
            Q(account=current_user.active_account) | Q(user=current_user, account=None)
        )
    else:
        databases = Database.objects(user=current_user)
    return jsonify([DatabaseSchema().dump(db.to_dict()) for db in databases]), 200


@api_v1.route("/databases", methods=["POST"])
@jwt_required()
@check_permission("database", "create")
@check_plan_limit("database")
def create_database():
    """Create a new database."""
    schema = DatabaseCreateSchema()

    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    # Generate slug and check uniqueness
    slug = Database.generate_slug(data["title"])

    # Check uniqueness within account or user scope
    if current_user.active_account:
        if Database.objects(account=current_user.active_account, slug=slug).first():
            return jsonify({"error": "A database with this title already exists"}), 409
    else:
        if Database.objects(user=current_user, slug=slug).first():
            return jsonify({"error": "A database with this title already exists"}), 409

    database = Database(
        title=data["title"],
        slug=slug,
        description=data.get("description", ""),
        user=current_user,
        account=current_user.active_account,
    )
    database.save()

    # Audit log
    log_action(
        database=database,
        user=current_user,
        action="DATABASE_CREATED",
        resource_type="database",
        resource_id=database.id,
        resource_name=database.title,
        new_state=serialize_for_audit(database),
        details=f"Created database '{database.title}'",
    )

    # Notify account members
    if current_user.active_account:
        notify_account_members(
            account=current_user.active_account,
            notification_type="database_created",
            title=f"New database: {database.title}",
            message=f"{current_user.email} created database '{database.title}'",
            link=f"/databases/{database.slug}",
            actor=current_user,
            exclude_user=current_user,
            database_slug=database.slug,
            resource_type="database",
            resource_id=database.id,
        )

    return jsonify({
        "message": "Database created successfully",
        "database": DatabaseSchema().dump(database.to_dict()),
    }), 201


def get_database_by_slug(slug):
    """Helper to get database by slug, checking both account and user ownership."""
    if current_user.active_account:
        database = Database.objects(
            Q(account=current_user.active_account, slug=slug) |
            Q(user=current_user, account=None, slug=slug)
        ).first()
    else:
        database = Database.objects(user=current_user, slug=slug).first()
    return database


@api_v1.route("/databases/<slug>", methods=["GET"])
@jwt_required()
def get_database(slug):
    """Get a specific database with its fields."""
    database = get_database_by_slug(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    return jsonify(DatabaseSchema().dump(database.to_dict(include_fields=True))), 200


@api_v1.route("/databases/<slug>", methods=["PUT"])
@jwt_required()
@check_permission("database", "update")
def update_database(slug):
    """Update a database."""
    database = get_database_by_slug(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    # Capture previous state for audit
    previous_state = serialize_for_audit(database)

    schema = DatabaseUpdateSchema()

    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    # Check if title change would create duplicate slug
    if "title" in data:
        new_slug = Database.generate_slug(data["title"])
        if new_slug != database.slug:
            # Check uniqueness within account or user scope
            if database.account:
                existing = Database.objects(account=database.account, slug=new_slug).first()
            else:
                existing = Database.objects(user=current_user, slug=new_slug).first()
            if existing:
                return jsonify({"error": "A database with this title already exists"}), 409
            database.slug = new_slug
        database.title = data["title"]

    if "description" in data:
        database.description = data["description"]

    database.save()

    # Audit log
    new_state = serialize_for_audit(database)
    changes = compute_changes(previous_state, new_state)
    log_action(
        database=database,
        user=current_user,
        action="DATABASE_UPDATED",
        resource_type="database",
        resource_id=database.id,
        resource_name=database.title,
        previous_state=previous_state,
        new_state=new_state,
        changes=changes,
        details=f"Updated database '{database.title}'",
    )

    # Notify account members
    if database.account:
        notify_account_members(
            account=database.account,
            notification_type="database_updated",
            title=f"Database updated: {database.title}",
            message=f"{current_user.email} updated database '{database.title}'",
            link=f"/databases/{database.slug}",
            actor=current_user,
            exclude_user=current_user,
            database_slug=database.slug,
            resource_type="database",
            resource_id=database.id,
        )

    return jsonify({
        "message": "Database updated successfully",
        "database": DatabaseSchema().dump(database.to_dict()),
    }), 200


@api_v1.route("/databases/<slug>", methods=["DELETE"])
@jwt_required()
@check_permission("database", "delete")
def delete_database(slug):
    """Delete a database and all its fields and entries."""
    database = get_database_by_slug(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    # Capture state for audit before deletion
    previous_state = serialize_for_audit(database)
    db_title = database.title
    db_slug = database.slug
    db_id = str(database.id)
    db_account = database.account

    # Audit log (create before deletion since database reference will be lost)
    log_action(
        database=None,  # Will be deleted
        user=current_user,
        action="DATABASE_DELETED",
        resource_type="database",
        resource_id=db_id,
        resource_name=db_title,
        previous_state=previous_state,
        details=f"Deleted database '{db_title}'",
        database_slug=db_slug,
        account=db_account,
    )

    # Notify account members before deletion
    if db_account:
        notify_account_members(
            account=db_account,
            notification_type="database_deleted",
            title=f"Database deleted: {db_title}",
            message=f"{current_user.email} deleted database '{db_title}'",
            link="/dashboard",
            actor=current_user,
            exclude_user=current_user,
            database_slug=db_slug,
            resource_type="database",
            resource_id=db_id,
        )

    # Delete all associated entries and fields (CASCADE should handle this,
    # but we do it explicitly for clarity)
    Entry.objects(database=database).delete()
    Field.objects(database=database).delete()
    database.delete()

    return jsonify({"message": "Database deleted successfully"}), 200
