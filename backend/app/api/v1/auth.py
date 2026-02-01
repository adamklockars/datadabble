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
from app.models import User

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

    # Check if user already exists
    if User.objects(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    # Create user
    user = User(
        email=data["email"],
        first_name=data.get("first_name", ""),
        last_name=data.get("last_name", ""),
    )
    user.set_password(data["password"])
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

    return jsonify(UserSchema().dump(user.to_dict())), 200
