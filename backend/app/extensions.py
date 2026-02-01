"""Flask extensions initialization."""
from flask_mongoengine import MongoEngine
from flask_jwt_extended import JWTManager
from flask_marshmallow import Marshmallow

db = MongoEngine()
jwt = JWTManager()
ma = Marshmallow()


@jwt.user_identity_loader
def user_identity_lookup(user):
    """Return user ID as identity for JWT."""
    return str(user.id) if hasattr(user, "id") else str(user)


@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    """Load user from JWT identity."""
    from app.models import User
    identity = jwt_data["sub"]
    return User.objects(id=identity).first()
