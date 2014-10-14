# Python imports
import uuid, json

# External imports
from flask import Flask, request, session, abort, g, url_for, jsonify

# Custom imports
from . import config

# What we export
__all__ = ['create_app', 'register_blueprints']

def register_blueprints(app):
    # Prevents circular imports
    from website.blueprints.front import front
    from website.blueprints.database import dbs

    app.register_blueprint(front)
    app.register_blueprint(dbs)

def create_app(config_object=None):
    if not config_object:
        config_object = 'website.config.DevelopmentConfig'

    app = Flask(__name__)
    app.config.from_object(config_object)

    if not app.debug:
        # We log when in production
        import logging
        from website.libs.errors import CustomLoggingHandler
        file_handler = CustomLoggingHandler('logs/flask_logs.log')
        file_handler.setLevel(logging.WARNING)
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s '
            '[in %(pathname)s:%(lineno)d]'
        ))
        app.logger.addHandler(file_handler)

    # CSRF protection
    @app.before_request
    def csrf_protect():
        if not app.testing:
            # We don't want CSRF if request is ajax
            if request.method == "POST" and not request.is_xhr:
                token = session.pop('_csrf_token', None)
                if not token or token != request.form.get('_csrf_token'):
                    abort(403)

    def generate_csrf_token():
        if '_csrf_token' not in session:
            session['_csrf_token'] = uuid.uuid4().hex
        return session['_csrf_token']

    app.jinja_env.globals['csrf_token'] = generate_csrf_token

    return app