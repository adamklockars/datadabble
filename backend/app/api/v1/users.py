"""User management API endpoints."""
import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from app.models import User, Account, AccountMembership, ResourcePermissions, Permissions
from app.api.v1.permissions import get_current_user, require_admin, is_account_admin
from app.api.v1.audit_helper import log_action

users_bp = Blueprint("users", __name__)


class InviteUserSchema(Schema):
    """Schema for inviting a user."""
    email = fields.Email(required=True)
    role = fields.String(validate=validate.OneOf(["admin", "member"]), load_default="member")
    permissions = fields.Dict(load_default=None)


class UpdateMembershipSchema(Schema):
    """Schema for updating a membership."""
    role = fields.String(validate=validate.OneOf(["admin", "member"]))
    permissions = fields.Dict()
    status = fields.String(validate=validate.OneOf(["active", "inactive"]))


invite_schema = InviteUserSchema()
update_membership_schema = UpdateMembershipSchema()


@users_bp.route("/account", methods=["GET"])
@jwt_required()
def get_current_account():
    """Get current user's active account."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.active_account:
        return jsonify({"account": None, "membership": None}), 200

    membership = AccountMembership.objects(
        user=user, account=user.active_account, status="active"
    ).first()

    return jsonify({
        "account": user.active_account.to_dict(),
        "membership": membership.to_dict() if membership else None,
    }), 200


@users_bp.route("/account/members", methods=["GET"])
@jwt_required()
def list_members():
    """List all members of the current account."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.active_account:
        return jsonify({"error": "No active account"}), 400

    # Check if user can read users
    membership = AccountMembership.objects(
        user=user, account=user.active_account, status="active"
    ).first()

    if not membership:
        return jsonify({"error": "No membership found"}), 403

    # Allow admins or users with user.read permission
    if membership.role != "admin" and not membership.has_permission("user", "read"):
        return jsonify({"error": "Permission denied"}), 403

    members = AccountMembership.objects(account=user.active_account)
    return jsonify({
        "members": [m.to_dict() for m in members],
        "total": members.count(),
    }), 200


@users_bp.route("/account/members", methods=["POST"])
@jwt_required()
@require_admin()
def invite_member():
    """Invite a new member to the account."""
    user = get_current_user()

    try:
        data = invite_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": err.messages}), 400

    email = data["email"].lower()

    # Check if user already exists
    invited_user = User.objects(email=email).first()

    if invited_user:
        # Check if already a member
        existing = AccountMembership.objects(
            user=invited_user, account=user.active_account
        ).first()
        if existing:
            if existing.status == "active":
                return jsonify({"error": "User is already a member"}), 400
            # Reactivate inactive membership
            existing.status = "active"
            existing.role = data["role"]
            if data["permissions"]:
                existing.permissions = ResourcePermissions.from_dict(data["permissions"])
            else:
                existing.permissions = ResourcePermissions.from_role(data["role"])
            existing.save()

            log_action(
                user=user,
                action="member_reactivated",
                resource_type="membership",
                resource_id=str(existing.id),
                new_state=existing.to_dict(),
                account=user.active_account,
            )

            return jsonify({"membership": existing.to_dict()}), 200

    if not invited_user:
        # Create a placeholder user - they'll set password when they accept
        invited_user = User(
            email=email,
            password_hash="pending",  # They'll need to set this
        )
        invited_user.save()

    # Create membership
    if data["permissions"]:
        permissions = ResourcePermissions.from_dict(data["permissions"])
    else:
        permissions = ResourcePermissions.from_role(data["role"])

    membership = AccountMembership(
        account=user.active_account,
        user=invited_user,
        role=data["role"],
        permissions=permissions,
        invited_by=user,
        invited_at=datetime.datetime.utcnow(),
        status="pending" if invited_user.password_hash == "pending" else "active",
    )
    membership.save()

    # Set as active account for new user
    if not invited_user.active_account:
        invited_user.active_account = user.active_account
        invited_user.save()

    log_action(
        user=user,
        action="member_invited",
        resource_type="membership",
        resource_id=str(membership.id),
        new_state=membership.to_dict(),
        account=user.active_account,
    )

    return jsonify({"membership": membership.to_dict()}), 201


@users_bp.route("/account/members/<member_id>", methods=["PUT"])
@jwt_required()
@require_admin()
def update_member(member_id):
    """Update a member's role or permissions."""
    user = get_current_user()

    try:
        data = update_membership_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": err.messages}), 400

    membership = AccountMembership.objects(
        id=member_id, account=user.active_account
    ).first()

    if not membership:
        return jsonify({"error": "Membership not found"}), 404

    # Prevent removing the last admin
    if data.get("role") == "member" and membership.role == "admin":
        admin_count = AccountMembership.objects(
            account=user.active_account, role="admin", status="active"
        ).count()
        if admin_count <= 1:
            return jsonify({"error": "Cannot remove the last admin"}), 400

    # Prevent deactivating yourself
    if data.get("status") == "inactive" and membership.user.id == user.id:
        return jsonify({"error": "Cannot deactivate yourself"}), 400

    previous_state = membership.to_dict()

    if "role" in data:
        membership.role = data["role"]
        # Update permissions to role defaults if role changed and no custom permissions
        if "permissions" not in data:
            membership.permissions = ResourcePermissions.from_role(data["role"])

    if "permissions" in data:
        membership.permissions = ResourcePermissions.from_dict(data["permissions"])

    if "status" in data:
        membership.status = data["status"]

    membership.save()

    log_action(
        user=user,
        action="member_updated",
        resource_type="membership",
        resource_id=str(membership.id),
        previous_state=previous_state,
        new_state=membership.to_dict(),
        account=user.active_account,
    )

    return jsonify({"membership": membership.to_dict()}), 200


@users_bp.route("/account/members/<member_id>", methods=["DELETE"])
@jwt_required()
@require_admin()
def remove_member(member_id):
    """Remove a member from the account."""
    user = get_current_user()

    membership = AccountMembership.objects(
        id=member_id, account=user.active_account
    ).first()

    if not membership:
        return jsonify({"error": "Membership not found"}), 404

    # Prevent removing yourself
    if membership.user.id == user.id:
        return jsonify({"error": "Cannot remove yourself"}), 400

    # Prevent removing the last admin
    if membership.role == "admin":
        admin_count = AccountMembership.objects(
            account=user.active_account, role="admin", status="active"
        ).count()
        if admin_count <= 1:
            return jsonify({"error": "Cannot remove the last admin"}), 400

    previous_state = membership.to_dict()

    # Clear user's active account if it matches
    if membership.user.active_account and membership.user.active_account.id == user.active_account.id:
        # Find another account for this user
        other_membership = AccountMembership.objects(
            user=membership.user, status="active"
        ).first()
        membership.user.active_account = other_membership.account if other_membership else None
        membership.user.save()

    membership.delete()

    log_action(
        user=user,
        action="member_removed",
        resource_type="membership",
        resource_id=member_id,
        previous_state=previous_state,
        account=user.active_account,
    )

    return jsonify({"message": "Member removed"}), 200


@users_bp.route("/accounts", methods=["GET"])
@jwt_required()
def list_accounts():
    """List all accounts the user is a member of."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    memberships = AccountMembership.objects(user=user, status__in=["active", "pending"])

    accounts = []
    for m in memberships:
        accounts.append({
            "account": m.account.to_dict(),
            "membership": m.to_dict(),
        })

    return jsonify({"accounts": accounts}), 200


@users_bp.route("/accounts/switch/<account_id>", methods=["POST"])
@jwt_required()
def switch_account(account_id):
    """Switch to a different account."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    account = Account.objects(id=account_id).first()
    if not account:
        return jsonify({"error": "Account not found"}), 404

    # Verify user is a member
    membership = AccountMembership.objects(
        user=user, account=account, status="active"
    ).first()

    if not membership:
        return jsonify({"error": "Not a member of this account"}), 403

    user.active_account = account
    user.save()

    return jsonify({
        "account": account.to_dict(),
        "membership": membership.to_dict(),
    }), 200
