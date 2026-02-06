"""Notification API endpoints."""
import datetime
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user

from app.api.v1 import api_v1
from app.models import Notification, NotificationPreference, NotificationChannel


@api_v1.route("/notifications", methods=["GET"])
@jwt_required()
def list_notifications():
    """List notifications for current user."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    per_page = min(per_page, 100)
    unread_only = request.args.get("unread_only", "false").lower() == "true"

    query = Notification.objects(user=current_user).order_by("-created_at")

    if unread_only:
        query = query.filter(read=False)

    total = query.count()
    notifications = query.skip((page - 1) * per_page).limit(per_page)

    unread_count = Notification.objects(user=current_user, read=False).count()

    return jsonify({
        "notifications": [n.to_dict() for n in notifications],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
        },
        "unread_count": unread_count,
    }), 200


@api_v1.route("/notifications/unread-count", methods=["GET"])
@jwt_required()
def unread_count():
    """Get unread notification count for header badge."""
    count = Notification.objects(user=current_user, read=False).count()
    return jsonify({"unread_count": count}), 200


@api_v1.route("/notifications/<notification_id>/read", methods=["PUT"])
@jwt_required()
def mark_as_read(notification_id):
    """Mark a single notification as read."""
    notification = Notification.objects(id=notification_id, user=current_user).first()
    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    notification.read = True
    notification.read_at = datetime.datetime.utcnow()
    notification.save()

    return jsonify({"notification": notification.to_dict()}), 200


@api_v1.route("/notifications/read-all", methods=["PUT"])
@jwt_required()
def mark_all_as_read():
    """Mark all notifications as read."""
    now = datetime.datetime.utcnow()
    Notification.objects(user=current_user, read=False).update(
        set__read=True, set__read_at=now
    )
    return jsonify({"message": "All notifications marked as read"}), 200


@api_v1.route("/notifications/<notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    """Delete a notification."""
    notification = Notification.objects(id=notification_id, user=current_user).first()
    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    notification.delete()
    return jsonify({"message": "Notification deleted"}), 200


@api_v1.route("/notifications/preferences", methods=["GET"])
@jwt_required()
def get_notification_preferences():
    """Get notification preferences (creates defaults if none exist)."""
    prefs = NotificationPreference.get_or_create(current_user)
    return jsonify({"preferences": prefs.to_dict()}), 200


@api_v1.route("/notifications/preferences", methods=["PUT"])
@jwt_required()
def update_notification_preferences():
    """Update notification preferences."""
    data = request.get_json() or {}
    prefs = NotificationPreference.get_or_create(current_user)

    if "email_enabled" in data:
        prefs.email_enabled = data["email_enabled"]

    if "weekly_digest" in data:
        prefs.weekly_digest = data["weekly_digest"]

    for category in ("team_invites", "database_changes", "entry_modifications", "field_changes"):
        if category in data and isinstance(data[category], dict):
            setattr(prefs, category, NotificationChannel.from_dict(data[category]))

    prefs.save()
    return jsonify({"preferences": prefs.to_dict()}), 200


@api_v1.route("/notifications/unsubscribe/<token>", methods=["GET"])
def unsubscribe(token):
    """Unsubscribe from email notifications (no auth required)."""
    prefs = NotificationPreference.objects(unsubscribe_token=token).first()
    if not prefs:
        return jsonify({"error": "Invalid unsubscribe link"}), 404

    prefs.email_enabled = False
    prefs.save()

    return jsonify({"message": "You have been unsubscribed from email notifications."}), 200
