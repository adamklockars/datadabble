"""Application factory for DataDabble."""
from flask import Flask
from flask_cors import CORS

from app.config import config
from app.extensions import db, jwt, ma, mail


def create_app(config_name: str = "development") -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    ma.init_app(app)
    mail.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # Register blueprints
    from app.api.v1 import api_v1
    from app.api.v1.users import users_bp
    app.register_blueprint(api_v1, url_prefix="/api/v1")
    app.register_blueprint(users_bp, url_prefix="/api/v1/users")

    # Register error handlers
    from app.utils.errors import register_error_handlers
    register_error_handlers(app)

    return app
