"""Database CRUD endpoints."""
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError

from app.api.v1 import api_v1
from app.api.schemas import DatabaseSchema, DatabaseCreateSchema, DatabaseUpdateSchema
from app.models import Database, Field, Entry


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

    # Delete all associated entries and fields (CASCADE should handle this,
    # but we do it explicitly for clarity)
    Entry.objects(database=database).delete()
    Field.objects(database=database).delete()
    database.delete()

    return jsonify({"message": "Database deleted successfully"}), 200
