"""Database CRUD endpoints."""
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError

from app.api.v1 import api_v1
from app.api.schemas import DatabaseSchema, DatabaseCreateSchema, DatabaseUpdateSchema
from app.models import Database, Field, Entry
from app.api.v1.audit_helper import log_action, compute_changes, serialize_for_audit


@api_v1.route("/databases", methods=["GET"])
@jwt_required()
def list_databases():
    """List all databases for current user."""
    databases = Database.objects(user=current_user)
    return jsonify([DatabaseSchema().dump(db.to_dict()) for db in databases]), 200


@api_v1.route("/databases", methods=["POST"])
@jwt_required()
def create_database():
    """Create a new database."""
    schema = DatabaseCreateSchema()

    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    # Generate slug and check uniqueness
    slug = Database.generate_slug(data["title"])
    if Database.objects(user=current_user, slug=slug).first():
        return jsonify({"error": "A database with this title already exists"}), 409

    database = Database(
        title=data["title"],
        slug=slug,
        description=data.get("description", ""),
        user=current_user,
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

    return jsonify({
        "message": "Database created successfully",
        "database": DatabaseSchema().dump(database.to_dict()),
    }), 201


@api_v1.route("/databases/<slug>", methods=["GET"])
@jwt_required()
def get_database(slug):
    """Get a specific database with its fields."""
    database = Database.objects(user=current_user, slug=slug).first()
    if not database:
        return jsonify({"error": "Database not found"}), 404

    return jsonify(DatabaseSchema().dump(database.to_dict(include_fields=True))), 200


@api_v1.route("/databases/<slug>", methods=["PUT"])
@jwt_required()
def update_database(slug):
    """Update a database."""
    database = Database.objects(user=current_user, slug=slug).first()
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
            if Database.objects(user=current_user, slug=new_slug).first():
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

    return jsonify({
        "message": "Database updated successfully",
        "database": DatabaseSchema().dump(database.to_dict()),
    }), 200


@api_v1.route("/databases/<slug>", methods=["DELETE"])
@jwt_required()
def delete_database(slug):
    """Delete a database and all its fields and entries."""
    database = Database.objects(user=current_user, slug=slug).first()
    if not database:
        return jsonify({"error": "Database not found"}), 404

    # Capture state for audit before deletion
    previous_state = serialize_for_audit(database)
    db_title = database.title
    db_slug = database.slug
    db_id = str(database.id)

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
    )

    # Delete all associated entries and fields (CASCADE should handle this,
    # but we do it explicitly for clarity)
    Entry.objects(database=database).delete()
    Field.objects(database=database).delete()
    database.delete()

    return jsonify({"message": "Database deleted successfully"}), 200
