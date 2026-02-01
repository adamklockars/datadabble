"""Error handlers for the application."""
from flask import jsonify
from werkzeug.exceptions import HTTPException
from marshmallow import ValidationError
from mongoengine.errors import ValidationError as MongoValidationError, DoesNotExist


def register_error_handlers(app):
    """Register error handlers with the Flask app."""

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            "error": "Bad Request",
            "message": str(error.description) if hasattr(error, "description") else "Invalid request",
        }), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            "error": "Unauthorized",
            "message": "Authentication required",
        }), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            "error": "Forbidden",
            "message": "You don't have permission to access this resource",
        }), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "error": "Not Found",
            "message": "The requested resource was not found",
        }), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            "error": "Method Not Allowed",
            "message": "The method is not allowed for this endpoint",
        }), 405

    @app.errorhandler(409)
    def conflict(error):
        return jsonify({
            "error": "Conflict",
            "message": str(error.description) if hasattr(error, "description") else "Resource conflict",
        }), 409

    @app.errorhandler(422)
    def unprocessable_entity(error):
        return jsonify({
            "error": "Unprocessable Entity",
            "message": "The request was well-formed but could not be processed",
        }), 422

    @app.errorhandler(429)
    def too_many_requests(error):
        return jsonify({
            "error": "Too Many Requests",
            "message": "Rate limit exceeded",
        }), 429

    @app.errorhandler(500)
    def internal_server_error(error):
        return jsonify({
            "error": "Internal Server Error",
            "message": "An unexpected error occurred",
        }), 500

    @app.errorhandler(ValidationError)
    def handle_marshmallow_validation_error(error):
        return jsonify({
            "error": "Validation Error",
            "messages": error.messages,
        }), 400

    @app.errorhandler(MongoValidationError)
    def handle_mongo_validation_error(error):
        return jsonify({
            "error": "Validation Error",
            "message": str(error),
        }), 400

    @app.errorhandler(DoesNotExist)
    def handle_does_not_exist(error):
        return jsonify({
            "error": "Not Found",
            "message": "The requested resource was not found",
        }), 404

    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        return jsonify({
            "error": error.name,
            "message": error.description,
        }), error.code

    @app.errorhandler(Exception)
    def handle_generic_exception(error):
        # Log the error in production
        app.logger.error(f"Unhandled exception: {error}")
        return jsonify({
            "error": "Internal Server Error",
            "message": "An unexpected error occurred",
        }), 500
