"""Notification service for creating and sending notifications."""
import logging
from flask import current_app
from flask_mail import Message

from app.extensions import mail
from app.models import Notification, NotificationPreference, AccountMembership

logger = logging.getLogger(__name__)


def create_notification(
    recipient,
    notification_type,
    title,
    message,
    link=None,
    actor=None,
    account=None,
    database_slug=None,
    resource_type=None,
    resource_id=None,
):
    """Create an in-app notification and optionally send email."""
    prefs = NotificationPreference.get_or_create(recipient)

    # Create in-app notification if enabled
    if prefs.should_notify(notification_type, "in_app"):
        notification = Notification(
            user=recipient,
            account=account,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            actor_email=actor.email if actor else None,
            database_slug=database_slug,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
        )
        notification.save()

    # Send email if enabled
    if prefs.should_notify(notification_type, "email"):
        send_email_notification(recipient, title, message, link, prefs.unsubscribe_token)


def send_email_notification(user, title, message, link=None, unsubscribe_token=None):
    """Send an email notification via Flask-Mail."""
    try:
        mail_username = current_app.config.get("MAIL_USERNAME", "")
        if not mail_username:
            return  # Email not configured

        base_url = current_app.config.get("APP_BASE_URL", "http://localhost:5173")

        body = f"{message}\n\n"
        if link:
            body += f"View in DataDabble: {base_url}{link}\n\n"
        if unsubscribe_token:
            body += f"Unsubscribe: {base_url}/api/v1/notifications/unsubscribe/{unsubscribe_token}\n"

        msg = Message(
            subject=f"DataDabble: {title}",
            recipients=[user.email],
            body=body,
        )
        mail.send(msg)
    except Exception as e:
        logger.warning("Failed to send email notification to %s: %s", user.email, e)


def notify_account_members(
    account,
    notification_type,
    title,
    message,
    link=None,
    actor=None,
    exclude_user=None,
    database_slug=None,
    resource_type=None,
    resource_id=None,
):
    """Send a notification to all active members of an account."""
    memberships = AccountMembership.objects(account=account, status="active")

    for membership in memberships:
        recipient = membership.user
        if exclude_user and recipient.id == exclude_user.id:
            continue

        create_notification(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            actor=actor,
            account=account,
            database_slug=database_slug,
            resource_type=resource_type,
            resource_id=resource_id,
        )
