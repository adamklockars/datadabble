"""Authentication endpoints."""
from flask import jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
    get_jwt,
)
from marshmallow import ValidationError

from app.api.v1 import api_v1
from app.api.schemas import UserCreateSchema, UserLoginSchema, UserSchema
from app.models import User, Account, AccountMembership, ResourcePermissions

# Token blocklist for logout
token_blocklist = set()


@api_v1.route("/auth/register", methods=["POST"])
def register():
    """Register a new user."""
    schema = UserCreateSchema()

    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    email = data["email"].lower()

    # Check if user already exists with a real password
    existing_user = User.objects(email=email).first()
    if existing_user and existing_user.password_hash != "pending":
        return jsonify({"error": "Email already registered"}), 409

    if existing_user and existing_user.password_hash == "pending":
        # User was invited - complete their registration
        user = existing_user
        user.first_name = data.get("first_name", "")
        user.last_name = data.get("last_name", "")
        user.set_password(data["password"])
        user.save()

        # Activate any pending memberships
        pending_memberships = AccountMembership.objects(user=user, status="pending")
        for membership in pending_memberships:
            membership.status = "active"
            membership.save()
    else:
        # Create new user
        user = User(
            email=email,
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
        )
        user.set_password(data["password"])
        user.save()

        # Create default account for user
        account_name = data.get("account_name") or f"{user.first_name or user.email.split('@')[0]}'s Workspace"
        account = Account(
            name=account_name,
            owner=user,
        )
        account.save()

        # Create admin membership
        membership = AccountMembership(
            account=account,
            user=user,
            role="admin",
            permissions=ResourcePermissions.from_role("admin"),
            status="active",
        )
        membership.save()

        # Set as active account
        user.active_account = account
        user.save()

    # Generate tokens
    access_token = create_access_token(identity=user)
    refresh_token = create_refresh_token(identity=user)

    return jsonify({
        "message": "User registered successfully",
        "user": UserSchema().dump(user.to_dict()),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 201


@api_v1.route("/auth/login", methods=["POST"])
def login():
    """Login user and return JWT tokens."""
    schema = UserLoginSchema()

    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "messages": err.messages}), 400

    # Find user
    user = User.objects(email=data["email"]).first()
    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid email or password"}), 401

    # Create account for existing users who don't have one
    if not user.active_account:
        # Check if user has any memberships
        existing_membership = AccountMembership.objects(user=user, status="active").first()
        if existing_membership:
            user.active_account = existing_membership.account
            user.save()
        else:
            # Create a new account for this user
            account_name = f"{user.first_name or user.email.split('@')[0]}'s Workspace"
            account = Account(
                name=account_name,
                owner=user,
            )
            account.save()

            # Create admin membership
            membership = AccountMembership(
                account=account,
                user=user,
                role="admin",
                permissions=ResourcePermissions.from_role("admin"),
                status="active",
            )
            membership.save()

            user.active_account = account
            user.save()

    # Generate tokens
    access_token = create_access_token(identity=user)
    refresh_token = create_refresh_token(identity=user)

    return jsonify({
        "message": "Login successful",
        "user": UserSchema().dump(user.to_dict()),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 200


@api_v1.route("/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    """Logout user by blocklisting current token."""
    jti = get_jwt()["jti"]
    token_blocklist.add(jti)
    return jsonify({"message": "Successfully logged out"}), 200


@api_v1.route("/auth/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token."""
    identity = get_jwt_identity()
    user = User.objects(id=identity).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    access_token = create_access_token(identity=user)

    return jsonify({
        "access_token": access_token,
    }), 200


@api_v1.route("/auth/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """Get current authenticated user."""
    identity = get_jwt_identity()
    user = User.objects(id=identity).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Create account for existing users who don't have one
    if not user.active_account:
        existing_membership = AccountMembership.objects(user=user, status="active").first()
        if existing_membership:
            user.active_account = existing_membership.account
            user.save()
        else:
            account_name = f"{user.first_name or user.email.split('@')[0]}'s Workspace"
            account = Account(
                name=account_name,
                owner=user,
            )
            account.save()

            membership = AccountMembership(
                account=account,
                user=user,
                role="admin",
                permissions=ResourcePermissions.from_role("admin"),
                status="active",
            )
            membership.save()

            user.active_account = account
            user.save()

    response = UserSchema().dump(user.to_dict())

    # Include account and membership info
    if user.active_account:
        response["account"] = user.active_account.to_dict()
        membership = AccountMembership.objects(
            user=user, account=user.active_account, status="active"
        ).first()
        if membership:
            response["membership"] = membership.to_dict()

    return jsonify(response), 200
