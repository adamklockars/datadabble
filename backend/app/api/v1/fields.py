"""Field CRUD endpoints."""
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError
from bson import ObjectId
from bson.errors import InvalidId

from app.api.v1 import api_v1
from app.api.schemas import FieldSchema, FieldCreateSchema, FieldUpdateSchema
from app.models import Database, Field, Entry
from app.api.v1.audit_helper import log_action, compute_changes, serialize_for_audit


def can_convert_value(value, from_type, to_type):
    """Check if a value can be converted between types without data loss."""
    if value is None or value == '':
        return True, None

    try:
        if to_type == 'STR':
            # Everything can become a string
            return True, str(value)
        elif to_type == 'INT':
            if isinstance(value, bool):
                return True, 1 if value else 0
            if isinstance(value, (int, float)):
                int_val = int(value)
                # Check if we lose decimal precision
                if isinstance(value, float) and value != int_val:
                    return False, None
                return True, int_val
            # Try parsing string
            str_val = str(value).strip()
            if str_val == '':
                return True, None
            int_val = int(float(str_val))
            if float(str_val) != int_val:
                return False, None
            return True, int_val
        elif to_type == 'DEC':
            if isinstance(value, (int, float, bool)):
                return True, float(value)
            str_val = str(value).strip()
            if str_val == '':
                return True, None
            return True, float(str_val)
        elif to_type == 'BOOL':
            if isinstance(value, bool):
                return True, value
            if isinstance(value, (int, float)):
                return True, bool(value)
            str_val = str(value).lower().strip()
            if str_val in ('true', '1', 'yes'):
                return True, True
            elif str_val in ('false', '0', 'no', ''):
                return True, False
            return False, None
        elif to_type == 'DATE':
            # Basic date string validation
            str_val = str(value).strip()
            if str_val == '':
                return True, None
            # Accept ISO format dates
            import re
            if re.match(r'^\d{4}-\d{2}-\d{2}', str_val):
                return True, str_val
            return False, None
        elif to_type == 'EMAIL':
            str_val = str(value).strip()
            if str_val == '':
                return True, None
            if '@' in str_val and '.' in str_val:
                return True, str_val
            return False, None
        elif to_type == 'URL':
            str_val = str(value).strip()
            if str_val == '':
                return True, None
            if str_val.startswith(('http://', 'https://')):
                return True, str_val
            return False, None
        elif to_type in ('DICT', 'LIST'):
            # Complex types - only allow if already that type
            if to_type == 'DICT' and isinstance(value, dict):
                return True, value
            if to_type == 'LIST' and isinstance(value, list):
                return True, value
            return False, None
        return False, None
    except (ValueError, TypeError):
        return False, None


def analyze_type_change(entries, field_name, from_type, to_type):
    """Analyze impact of changing field type on existing entries."""
    affected_entries = []
    convertible_count = 0
    total_with_value = 0

    for entry in entries:
        value = entry.values.get(field_name)
        if value is None or value == '':
            continue
        total_with_value += 1
        can_convert, _ = can_convert_value(value, from_type, to_type)
        if can_convert:
            convertible_count += 1
        else:
            affected_entries.append({
                'entry_id': str(entry.id),
                'current_value': str(value)[:100],  # Truncate long values
            })

    return {
        'total_entries': len(entries),
        'entries_with_value': total_with_value,
        'convertible': convertible_count,
        'will_lose_data': len(affected_entries),
        'affected_entries': affected_entries[:10],  # Limit to first 10
    }


def get_database_or_404(slug):
    """Get database owned by current user or return 404."""
    database = Database.objects(user=current_user, slug=slug).first()
    if not database:
        return None
    return database


@api_v1.route("/databases/<slug>/fields", methods=["GET"])
@jwt_required()
def list_fields(slug):
    """List all fields for a database."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    fields = Field.objects(database=database).order_by("order", "-created_at")
    return jsonify([FieldSchema().dump(f.to_dict()) for f in fields]), 200


@api_v1.route("/databases/<slug>/fields", methods=["POST"])
@jwt_required()
def create_field(slug):
    """Create a new field in a database."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    schema = FieldCreateSchema()

    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    # Check for duplicate field name
    if Field.objects(database=database, name=data["name"]).first():
        return jsonify({"error": "A field with this name already exists"}), 409

    field = Field(
        database=database,
        name=data["name"],
        field_type=data["field_type"],
        required=data.get("required", False),
        default_value=data.get("default_value"),
        order=data.get("order", 0),
    )
    field.save()

    # Audit log
    log_action(
        database=database,
        user=current_user,
        action="FIELD_CREATED",
        resource_type="field",
        resource_id=field.id,
        resource_name=field.name,
        new_state=serialize_for_audit(field),
        details=f"Created field '{field.name}' ({field.field_type})",
    )

    return jsonify({
        "message": "Field created successfully",
        "field": FieldSchema().dump(field.to_dict()),
    }), 201


@api_v1.route("/databases/<slug>/fields/<field_id>", methods=["GET"])
@jwt_required()
def get_field(slug, field_id):
    """Get a specific field."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    try:
        field = Field.objects(database=database, id=ObjectId(field_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid field ID"}), 400

    if not field:
        return jsonify({"error": "Field not found"}), 404

    return jsonify(FieldSchema().dump(field.to_dict())), 200


@api_v1.route("/databases/<slug>/fields/<field_id>/preview-type-change", methods=["POST"])
@jwt_required()
def preview_type_change(slug, field_id):
    """Preview the impact of changing a field's type."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    try:
        field = Field.objects(database=database, id=ObjectId(field_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid field ID"}), 400

    if not field:
        return jsonify({"error": "Field not found"}), 404

    data = request.get_json()
    new_type = data.get("field_type")
    if not new_type:
        return jsonify({"error": "field_type is required"}), 400

    if new_type == field.field_type:
        return jsonify({"will_lose_data": 0, "message": "No type change"}), 200

    entries = Entry.objects(database=database)
    analysis = analyze_type_change(list(entries), field.name, field.field_type, new_type)

    return jsonify(analysis), 200


@api_v1.route("/databases/<slug>/fields/<field_id>", methods=["PUT"])
@jwt_required()
def update_field(slug, field_id):
    """Update a field."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    try:
        field = Field.objects(database=database, id=ObjectId(field_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid field ID"}), 400

    if not field:
        return jsonify({"error": "Field not found"}), 404

    # Capture previous state for audit
    previous_state = serialize_for_audit(field)

    schema = FieldUpdateSchema()
    raw_data = request.get_json()
    confirm_data_loss = raw_data.pop("confirm_data_loss", False) if raw_data else False

    try:
        data = schema.load(raw_data)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    old_name = field.name
    old_type = field.field_type
    entries = list(Entry.objects(database=database))

    # Check for duplicate name if changing
    if "name" in data and data["name"] != field.name:
        if Field.objects(database=database, name=data["name"]).first():
            return jsonify({"error": "A field with this name already exists"}), 409

    # Check type change impact
    if "field_type" in data and data["field_type"] != old_type:
        analysis = analyze_type_change(entries, field.name, old_type, data["field_type"])
        if analysis["will_lose_data"] > 0 and not confirm_data_loss:
            return jsonify({
                "error": "Type change will cause data loss",
                "requires_confirmation": True,
                "analysis": analysis,
            }), 409

    # Apply field name change and migrate entry values
    if "name" in data and data["name"] != old_name:
        new_name = data["name"]
        for entry in entries:
            if old_name in entry.values:
                entry.values[new_name] = entry.values.pop(old_name)
                entry.save()
        field.name = new_name

    # Apply type change and convert values
    if "field_type" in data and data["field_type"] != old_type:
        new_type = data["field_type"]
        field_name = field.name  # Use current name (may have been updated)
        for entry in entries:
            if field_name in entry.values:
                value = entry.values[field_name]
                can_convert, converted = can_convert_value(value, old_type, new_type)
                if can_convert and converted is not None:
                    entry.values[field_name] = converted
                elif not can_convert:
                    # Clear values that can't be converted
                    entry.values[field_name] = None
                entry.save()
        field.field_type = new_type

    if "required" in data:
        field.required = data["required"]
    if "default_value" in data:
        field.default_value = data["default_value"]
    if "order" in data:
        field.order = data["order"]

    field.save()

    # Audit log
    new_state = serialize_for_audit(field)
    changes = compute_changes(previous_state, new_state)
    log_action(
        database=database,
        user=current_user,
        action="FIELD_UPDATED",
        resource_type="field",
        resource_id=field.id,
        resource_name=field.name,
        previous_state=previous_state,
        new_state=new_state,
        changes=changes,
        details=f"Updated field '{field.name}'",
    )

    return jsonify({
        "message": "Field updated successfully",
        "field": FieldSchema().dump(field.to_dict()),
    }), 200


@api_v1.route("/databases/<slug>/fields/<field_id>", methods=["DELETE"])
@jwt_required()
def delete_field(slug, field_id):
    """Delete a field."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    try:
        field = Field.objects(database=database, id=ObjectId(field_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid field ID"}), 400

    if not field:
        return jsonify({"error": "Field not found"}), 404

    # Capture state for audit
    previous_state = serialize_for_audit(field)
    field_name = field.name
    field_id_str = str(field.id)

    # Audit log before deletion
    log_action(
        database=database,
        user=current_user,
        action="FIELD_DELETED",
        resource_type="field",
        resource_id=field_id_str,
        resource_name=field_name,
        previous_state=previous_state,
        details=f"Deleted field '{field_name}'",
    )

    field.delete()

    return jsonify({"message": "Field deleted successfully"}), 200


@api_v1.route("/databases/<slug>/fields/reorder", methods=["POST"])
@jwt_required()
def reorder_fields(slug):
    """Reorder fields in a database."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    data = request.get_json()
    field_ids = data.get("field_ids", [])

    if not field_ids:
        return jsonify({"error": "field_ids is required"}), 400

    # Capture previous order for audit
    old_fields = list(Field.objects(database=database).order_by("order", "-created_at"))
    previous_order = [f.name for f in old_fields]

    # Validate all field IDs belong to this database
    for i, field_id in enumerate(field_ids):
        try:
            field = Field.objects(database=database, id=ObjectId(field_id)).first()
        except InvalidId:
            return jsonify({"error": f"Invalid field ID: {field_id}"}), 400

        if not field:
            return jsonify({"error": f"Field not found: {field_id}"}), 404

        field.order = i
        field.save()

    fields = Field.objects(database=database).order_by("order", "-created_at")
    new_order = [f.name for f in fields]

    # Audit log
    log_action(
        database=database,
        user=current_user,
        action="FIELD_REORDERED",
        resource_type="field",
        previous_state={"order": previous_order},
        new_state={"order": new_order},
        changes={"order": {"from": previous_order, "to": new_order}},
        details=f"Reordered {len(field_ids)} fields",
    )

    return jsonify({
        "message": "Fields reordered successfully",
        "fields": [FieldSchema().dump(f.to_dict()) for f in fields],
    }), 200
