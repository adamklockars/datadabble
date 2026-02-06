"""Developer API endpoints for OAuth client management."""
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user

from app.api.v1 import api_v1
from app.models import OAuthClient
from app.api.v1.oauth_scopes import SCOPES


@api_v1.route("/developer/scopes", methods=["GET"])
@jwt_required()
def list_scopes():
    """List all available OAuth scopes."""
    scopes = [{"name": name, "description": desc} for name, desc in SCOPES.items()]
    return jsonify({"scopes": scopes}), 200


@api_v1.route("/developer/clients", methods=["GET"])
@jwt_required()
def list_clients():
    """List current user's OAuth clients."""
    clients = OAuthClient.objects(user=current_user)
    return jsonify({
        "clients": [c.to_dict() for c in clients],
        "total": clients.count(),
    }), 200


@api_v1.route("/developer/clients", methods=["POST"])
@jwt_required()
def create_client():
    """Create a new OAuth client. Returns the client secret once."""
    data = request.get_json() or {}

    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Client name is required"}), 400

    description = data.get("description", "").strip()
    redirect_uris = data.get("redirect_uris", [])
    scopes = data.get("scopes", [])

    # Validate redirect URIs
    if not isinstance(redirect_uris, list):
        return jsonify({"error": "redirect_uris must be a list"}), 400

    # Validate scopes
    if not isinstance(scopes, list):
        return jsonify({"error": "scopes must be a list"}), 400
    invalid_scopes = [s for s in scopes if s not in SCOPES]
    if invalid_scopes:
        return jsonify({"error": f"Invalid scopes: {', '.join(invalid_scopes)}"}), 400

    client_id = OAuthClient.generate_client_id()
    client_secret = OAuthClient.generate_client_secret()

    client = OAuthClient(
        client_id=client_id,
        name=name,
        description=description,
        redirect_uris=redirect_uris,
        scopes=scopes,
        user=current_user,
        account=current_user.active_account,
    )
    client.set_secret(client_secret)
    client.save()

    result = client.to_dict()
    result["client_secret"] = client_secret

    return jsonify({
        "message": "OAuth client created successfully. Save the client_secret now - it will not be shown again.",
        "client": result,
    }), 201


@api_v1.route("/developer/clients/<client_id>", methods=["GET"])
@jwt_required()
def get_client(client_id):
    """Get details of a specific OAuth client."""
    client = OAuthClient.objects(client_id=client_id, user=current_user).first()
    if not client:
        return jsonify({"error": "Client not found"}), 404
    return jsonify(client.to_dict()), 200


@api_v1.route("/developer/clients/<client_id>", methods=["PUT"])
@jwt_required()
def update_client(client_id):
    """Update an OAuth client."""
    client = OAuthClient.objects(client_id=client_id, user=current_user).first()
    if not client:
        return jsonify({"error": "Client not found"}), 404

    data = request.get_json() or {}

    if "name" in data:
        name = data["name"].strip()
        if not name:
            return jsonify({"error": "Client name cannot be empty"}), 400
        client.name = name

    if "description" in data:
        client.description = data["description"].strip()

    if "redirect_uris" in data:
        if not isinstance(data["redirect_uris"], list):
            return jsonify({"error": "redirect_uris must be a list"}), 400
        client.redirect_uris = data["redirect_uris"]

    if "scopes" in data:
        if not isinstance(data["scopes"], list):
            return jsonify({"error": "scopes must be a list"}), 400
        invalid_scopes = [s for s in data["scopes"] if s not in SCOPES]
        if invalid_scopes:
            return jsonify({"error": f"Invalid scopes: {', '.join(invalid_scopes)}"}), 400
        client.scopes = data["scopes"]

    if "active" in data:
        client.active = bool(data["active"])

    client.save()

    return jsonify({
        "message": "Client updated successfully",
        "client": client.to_dict(),
    }), 200


@api_v1.route("/developer/clients/<client_id>", methods=["DELETE"])
@jwt_required()
def delete_client(client_id):
    """Delete an OAuth client."""
    client = OAuthClient.objects(client_id=client_id, user=current_user).first()
    if not client:
        return jsonify({"error": "Client not found"}), 404

    # Revoke all tokens for this client
    from app.models import OAuthToken
    OAuthToken.objects(client=client).update(set__revoked=True)

    client.delete()
    return jsonify({"message": "Client deleted successfully"}), 200


@api_v1.route("/developer/clients/<client_id>/rotate-secret", methods=["POST"])
@jwt_required()
def rotate_client_secret(client_id):
    """Rotate client secret. Returns the new secret once."""
    client = OAuthClient.objects(client_id=client_id, user=current_user).first()
    if not client:
        return jsonify({"error": "Client not found"}), 404

    new_secret = OAuthClient.generate_client_secret()
    client.set_secret(new_secret)
    client.save()

    # Revoke all existing tokens
    from app.models import OAuthToken
    OAuthToken.objects(client=client).update(set__revoked=True)

    result = client.to_dict()
    result["client_secret"] = new_secret

    return jsonify({
        "message": "Client secret rotated. Save the new secret now - it will not be shown again.",
        "client": result,
    }), 200
