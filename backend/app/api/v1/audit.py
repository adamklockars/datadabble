"""Audit log endpoints."""
import csv
import io
from flask import jsonify, request, Response
from flask_jwt_extended import jwt_required, current_user

from app.api.v1 import api_v1
from app.models import Database, AuditLog


def get_database_or_404(slug):
    """Get database owned by current user or return 404."""
    database = Database.objects(user=current_user, slug=slug).first()
    if not database:
        return None
    return database


@api_v1.route("/databases/<slug>/audit-logs", methods=["GET"])
@jwt_required()
def list_audit_logs(slug):
    """List audit logs for a database."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    # Pagination
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 100)  # Limit max per page

    # Filters
    action_filter = request.args.get("action")
    resource_type_filter = request.args.get("resource_type")

    # Build query
    query = AuditLog.objects(database_slug=slug).order_by("-created_at")

    if action_filter:
        query = query.filter(action=action_filter)
    if resource_type_filter:
        query = query.filter(resource_type=resource_type_filter)

    # Get total count
    total = query.count()

    # Paginate
    logs = query.skip((page - 1) * per_page).limit(per_page)

    return jsonify({
        "audit_logs": [log.to_dict() for log in logs],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
        },
    }), 200


@api_v1.route("/databases/<slug>/audit-logs/export", methods=["GET"])
@jwt_required()
def export_audit_logs(slug):
    """Export audit logs as CSV."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    # Filters
    action_filter = request.args.get("action")
    resource_type_filter = request.args.get("resource_type")

    # Build query
    query = AuditLog.objects(database_slug=slug).order_by("-created_at")

    if action_filter:
        query = query.filter(action=action_filter)
    if resource_type_filter:
        query = query.filter(resource_type=resource_type_filter)

    # Limit to last 10000 entries
    logs = query.limit(10000)

    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Timestamp",
        "User",
        "Action",
        "Resource Type",
        "Resource Name",
        "Resource ID",
        "Details",
        "Changes",
    ])

    # Rows
    for log in logs:
        changes_str = ""
        if log.changes:
            changes_parts = []
            for key, val in log.changes.items():
                changes_parts.append(f"{key}: {val.get('from', 'N/A')} -> {val.get('to', 'N/A')}")
            changes_str = "; ".join(changes_parts)

        writer.writerow([
            log.created_at.isoformat() if log.created_at else "",
            log.user_email,
            log.action,
            log.resource_type,
            log.resource_name or "",
            log.resource_id or "",
            log.details or "",
            changes_str,
        ])

    # Return CSV response
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={slug}-audit-log.csv"
        }
    )


@api_v1.route("/databases/<slug>/audit-logs/stats", methods=["GET"])
@jwt_required()
def audit_log_stats(slug):
    """Get audit log statistics."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    # Count by action type
    pipeline = [
        {"$match": {"database_slug": slug}},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
    ]

    action_counts = {}
    for result in AuditLog.objects.aggregate(pipeline):
        action_counts[result["_id"]] = result["count"]

    # Count by resource type
    pipeline = [
        {"$match": {"database_slug": slug}},
        {"$group": {"_id": "$resource_type", "count": {"$sum": 1}}},
    ]

    resource_counts = {}
    for result in AuditLog.objects.aggregate(pipeline):
        resource_counts[result["_id"]] = result["count"]

    # Total count
    total = AuditLog.objects(database_slug=slug).count()

    return jsonify({
        "total": total,
        "by_action": action_counts,
        "by_resource": resource_counts,
    }), 200
