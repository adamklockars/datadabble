"""Entry CRUD endpoints."""
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError
from bson import ObjectId
from bson.errors import InvalidId

from app.api.v1 import api_v1
from app.api.schemas import EntrySchema, EntryCreateSchema, EntryUpdateSchema
from app.models import Database, Entry


def get_database_or_404(slug):
    """Get database owned by current user or return 404."""
    database = Database.objects(user=current_user, slug=slug).first()
    if not database:
        return None
    return database


@api_v1.route("/databases/<slug>/entries", methods=["GET"])
@jwt_required()
def list_entries(slug):
    """List entries for a database with pagination."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    # Pagination parameters
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    per_page = min(per_page, 100)  # Max 100 per page

    # Get total count
    total = Entry.objects(database=database).count()

    # Get paginated entries
    skip = (page - 1) * per_page
    entries = Entry.objects(database=database).skip(skip).limit(per_page)

    return jsonify({
        "entries": [EntrySchema().dump(e.to_dict()) for e in entries],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
        },
    }), 200


@api_v1.route("/databases/<slug>/entries", methods=["POST"])
@jwt_required()
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

    schema = EntryUpdateSchema()

    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    entry.values = data["values"]
    entry.save()

    return jsonify({
        "message": "Entry updated successfully",
        "entry": EntrySchema().dump(entry.to_dict()),
    }), 200


@api_v1.route("/databases/<slug>/entries/<entry_id>", methods=["DELETE"])
@jwt_required()
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

    entry.delete()

    return jsonify({"message": "Entry deleted successfully"}), 200
