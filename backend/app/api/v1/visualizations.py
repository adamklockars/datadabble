"""Visualization CRUD and chart data endpoints."""
import datetime
from collections import defaultdict
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user
from marshmallow import ValidationError
from bson import ObjectId
from bson.errors import InvalidId

from app.api.v1 import api_v1
from app.api.schemas import (
    VisualizationSchema,
    VisualizationCreateSchema,
    VisualizationUpdateSchema,
)
from app.models import Database, Entry, Visualization

# Special x_field values for entry timestamps (grouped by day)
X_FIELD_CREATED_AT = "__created_at__"
X_FIELD_UPDATED_AT = "__updated_at__"


def get_database_or_404(slug):
    """Get database owned by current user or return None."""
    return Database.objects(user=current_user, slug=slug).first()


def _get_entry_x_value(entry, x_field):
    """Get the x-axis value for an entry: from values dict or from timestamp fields."""
    if x_field == X_FIELD_CREATED_AT:
        dt = entry.created_at
        if dt is None:
            return "(empty)"
        if isinstance(dt, datetime.datetime):
            return dt.strftime("%Y-%m-%d")
        return str(dt)[:10] if len(str(dt)) >= 10 else str(dt)
    if x_field == X_FIELD_UPDATED_AT:
        dt = entry.updated_at
        if dt is None:
            return "(empty)"
        if isinstance(dt, datetime.datetime):
            return dt.strftime("%Y-%m-%d")
        return str(dt)[:10] if len(str(dt)) >= 10 else str(dt)
    raw = (entry.values or {}).get(x_field)
    return str(raw) if raw is not None else "(empty)"


def _aggregate_entries(database, x_field, y_field, aggregation):
    """Aggregate entries by x_field; return list of {name, value}."""
    entries = Entry.objects(database=database)
    buckets = defaultdict(lambda: 0 if aggregation == "count" else 0.0)
    for entry in entries:
        label = _get_entry_x_value(entry, x_field)
        if aggregation == "count":
            buckets[label] += 1
        else:
            raw_y = (entry.values or {}).get(y_field)
            try:
                val = float(raw_y) if raw_y is not None else 0
            except (TypeError, ValueError):
                val = 0
            buckets[label] += val
    return [{"name": k, "value": v} for k, v in sorted(buckets.items())]


@api_v1.route("/visualizations", methods=["GET"])
@jwt_required()
def list_visualizations():
    """List all visualizations for current user."""
    viz = Visualization.objects(user=current_user)
    return jsonify([VisualizationSchema().dump(v.to_dict()) for v in viz]), 200


@api_v1.route("/visualizations", methods=["POST"])
@jwt_required()
def create_visualization():
    """Create a new visualization."""
    schema = VisualizationCreateSchema()
    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    for slug in data["database_slugs"]:
        if not get_database_or_404(slug):
            return jsonify({"error": f"Database not found: {slug}"}), 404

    viz = Visualization(
        user=current_user,
        title=data["title"],
        chart_type=data["chart_type"],
        database_slugs=data["database_slugs"],
        x_field=data["x_field"],
        y_field=data.get("y_field"),
        aggregation=data.get("aggregation", "count"),
    )
    viz.save()
    return jsonify(VisualizationSchema().dump(viz.to_dict())), 201


@api_v1.route("/visualizations/<viz_id>", methods=["GET"])
@jwt_required()
def get_visualization(viz_id):
    """Get a single visualization."""
    try:
        viz = Visualization.objects(user=current_user, id=ObjectId(viz_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid visualization ID"}), 400
    if not viz:
        return jsonify({"error": "Visualization not found"}), 404
    return jsonify(VisualizationSchema().dump(viz.to_dict())), 200


@api_v1.route("/visualizations/<viz_id>", methods=["PUT"])
@jwt_required()
def update_visualization(viz_id):
    """Update a visualization."""
    try:
        viz = Visualization.objects(user=current_user, id=ObjectId(viz_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid visualization ID"}), 400
    if not viz:
        return jsonify({"error": "Visualization not found"}), 404

    schema = VisualizationUpdateSchema()
    try:
        data = schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    if "database_slugs" in data:
        for slug in data["database_slugs"]:
            if not get_database_or_404(slug):
                return jsonify({"error": f"Database not found: {slug}"}), 404
        viz.database_slugs = data["database_slugs"]
    for key in ("title", "chart_type", "x_field", "y_field", "aggregation"):
        if key in data:
            setattr(viz, key, data[key])
    viz.save()
    return jsonify(VisualizationSchema().dump(viz.to_dict())), 200


@api_v1.route("/visualizations/<viz_id>", methods=["DELETE"])
@jwt_required()
def delete_visualization(viz_id):
    """Delete a visualization."""
    try:
        viz = Visualization.objects(user=current_user, id=ObjectId(viz_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid visualization ID"}), 400
    if not viz:
        return jsonify({"error": "Visualization not found"}), 404
    viz.delete()
    return jsonify({"message": "Visualization deleted successfully"}), 200


@api_v1.route("/visualizations/<viz_id>/data", methods=["GET"])
@jwt_required()
def get_visualization_data(viz_id):
    """Get chart-ready data for a saved visualization."""
    try:
        viz = Visualization.objects(user=current_user, id=ObjectId(viz_id)).first()
    except InvalidId:
        return jsonify({"error": "Invalid visualization ID"}), 400
    if not viz:
        return jsonify({"error": "Visualization not found"}), 404

    aggregation = viz.aggregation or "count"
    y_field = viz.y_field if aggregation == "sum" else None
    if aggregation == "sum" and not y_field:
        aggregation = "count"

    series = []
    all_labels = set()
    for slug in viz.database_slugs:
        database = get_database_or_404(slug)
        if not database:
            continue
        points = _aggregate_entries(database, viz.x_field, y_field, aggregation)
        labels = {p["name"] for p in points}
        all_labels.update(labels)
        series.append({
            "database_slug": slug,
            "database_title": database.title,
            "data": points,
        })

    labels_sorted = sorted(all_labels)
    return jsonify({
        "labels": labels_sorted,
        "series": series,
        "chart_type": viz.chart_type,
        "x_field": viz.x_field,
        "y_field": viz.y_field,
        "aggregation": aggregation,
    }), 200


@api_v1.route("/visualizations/data", methods=["POST"])
@jwt_required()
def get_ad_hoc_visualization_data():
    """Get chart-ready data for an ad-hoc config (e.g. when creating a viz)."""
    body = request.get_json() or {}
    database_slugs = body.get("database_slugs") or []
    x_field = (body.get("x_field") or "").strip()
    y_field = (body.get("y_field") or "").strip() or None
    aggregation = body.get("aggregation") or "count"
    if aggregation == "sum" and not y_field:
        aggregation = "count"

    if not database_slugs or not x_field:
        return jsonify({"error": "database_slugs and x_field are required"}), 400

    series = []
    all_labels = set()
    for slug in database_slugs:
        database = get_database_or_404(slug)
        if not database:
            return jsonify({"error": f"Database not found: {slug}"}), 404
        points = _aggregate_entries(database, x_field, y_field, aggregation)
        all_labels.update(p["name"] for p in points)
        series.append({
            "database_slug": slug,
            "database_title": database.title,
            "data": points,
        })

    return jsonify({
        "labels": sorted(all_labels),
        "series": series,
    }), 200
