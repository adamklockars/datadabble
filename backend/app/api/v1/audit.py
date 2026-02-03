"""Audit log endpoints."""
import csv
import io
import datetime
from flask import jsonify, request, Response
from flask_jwt_extended import jwt_required, current_user
from mongoengine import Q

from app.api.v1 import api_v1
from app.models import Database, AuditLog


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


# ---- Account-wide audit log endpoints ----


def _build_account_audit_query(account):
    """Build a filtered query for account-wide audit logs."""
    query = AuditLog.objects(account=account).order_by("-created_at")

    # Filter by user
    user_id = request.args.get("user_id")
    user_email = request.args.get("user_email")
    if user_id:
        query = query.filter(user=user_id)
    elif user_email:
        query = query.filter(user_email=user_email)

    # Filter by action
    action_filter = request.args.get("action")
    if action_filter:
        query = query.filter(action=action_filter)

    # Filter by resource type
    resource_type_filter = request.args.get("resource_type")
    if resource_type_filter:
        query = query.filter(resource_type=resource_type_filter)

    # Filter by database slug
    database_slug = request.args.get("database_slug")
    if database_slug:
        query = query.filter(database_slug=database_slug)

    # Date range filters
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    if date_from:
        try:
            dt_from = datetime.datetime.fromisoformat(date_from)
            query = query.filter(created_at__gte=dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.datetime.fromisoformat(date_to)
            query = query.filter(created_at__lte=dt_to)
        except ValueError:
            pass

    return query


@api_v1.route("/audit-logs", methods=["GET"])
@jwt_required()
def list_account_audit_logs():
    """List audit logs across all databases in the current account."""
    if not current_user.active_account:
        return jsonify({"error": "No active account"}), 400

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 100)

    query = _build_account_audit_query(current_user.active_account)
    total = query.count()
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


@api_v1.route("/audit-logs/export", methods=["GET"])
@jwt_required()
def export_account_audit_logs():
    """Export account-wide audit logs as CSV."""
    if not current_user.active_account:
        return jsonify({"error": "No active account"}), 400

    query = _build_account_audit_query(current_user.active_account)
    logs = query.limit(10000)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Timestamp",
        "User",
        "Database",
        "Action",
        "Resource Type",
        "Resource Name",
        "Resource ID",
        "Details",
        "Changes",
    ])

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
            log.database_slug,
            log.action,
            log.resource_type,
            log.resource_name or "",
            log.resource_id or "",
            log.details or "",
            changes_str,
        ])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=account-audit-log.csv"
        }
    )


@api_v1.route("/audit-logs/stats", methods=["GET"])
@jwt_required()
def account_audit_log_stats():
    """Get account-wide audit log statistics."""
    if not current_user.active_account:
        return jsonify({"error": "No active account"}), 400

    account_id = current_user.active_account.id

    # Count by action
    action_pipeline = [
        {"$match": {"account": account_id}},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
    ]
    action_counts = {}
    for result in AuditLog.objects.aggregate(action_pipeline):
        action_counts[result["_id"]] = result["count"]

    # Count by resource type
    resource_pipeline = [
        {"$match": {"account": account_id}},
        {"$group": {"_id": "$resource_type", "count": {"$sum": 1}}},
    ]
    resource_counts = {}
    for result in AuditLog.objects.aggregate(resource_pipeline):
        resource_counts[result["_id"]] = result["count"]

    # Count by user
    user_pipeline = [
        {"$match": {"account": account_id}},
        {"$group": {"_id": "$user_email", "count": {"$sum": 1}}},
    ]
    user_counts = {}
    for result in AuditLog.objects.aggregate(user_pipeline):
        user_counts[result["_id"]] = result["count"]

    # Count by database
    db_pipeline = [
        {"$match": {"account": account_id}},
        {"$group": {"_id": "$database_slug", "count": {"$sum": 1}}},
    ]
    db_counts = {}
    for result in AuditLog.objects.aggregate(db_pipeline):
        db_counts[result["_id"]] = result["count"]

    total = AuditLog.objects(account=current_user.active_account).count()

    return jsonify({
        "total": total,
        "by_action": action_counts,
        "by_resource": resource_counts,
        "by_user": user_counts,
        "by_database": db_counts,
    }), 200


@api_v1.route("/audit-logs/users", methods=["GET"])
@jwt_required()
def account_audit_log_users():
    """Get distinct user emails for audit log filter dropdown."""
    if not current_user.active_account:
        return jsonify({"error": "No active account"}), 400

    account_id = current_user.active_account.id

    pipeline = [
        {"$match": {"account": account_id}},
        {"$group": {"_id": "$user_email"}},
        {"$sort": {"_id": 1}},
    ]

    users = [result["_id"] for result in AuditLog.objects.aggregate(pipeline)]

    return jsonify({"users": users}), 200
