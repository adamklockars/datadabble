"""OAuth 2.0 authorization server endpoints."""
import datetime
import hashlib
import base64
from flask import jsonify, request
from flask_jwt_extended import jwt_required, current_user

from app.api.v1 import api_v1
from app.models import OAuthClient, OAuthAuthorizationCode, OAuthToken
from app.api.v1.oauth_scopes import SCOPES


@api_v1.route("/oauth2/authorize", methods=["GET"])
@jwt_required()
def oauth2_authorize():
    """OAuth 2.0 authorization endpoint. Returns authorization details for consent screen."""
    client_id = request.args.get("client_id")
    redirect_uri = request.args.get("redirect_uri")
    scope = request.args.get("scope", "")
    state = request.args.get("state", "")
    response_type = request.args.get("response_type", "code")
    code_challenge = request.args.get("code_challenge")
    code_challenge_method = request.args.get("code_challenge_method", "S256")

    if response_type != "code":
        return jsonify({"error": "unsupported_response_type", "error_description": "Only 'code' response type is supported"}), 400

    if not client_id:
        return jsonify({"error": "invalid_request", "error_description": "client_id is required"}), 400

    client = OAuthClient.objects(client_id=client_id, active=True).first()
    if not client:
        return jsonify({"error": "invalid_client", "error_description": "Client not found"}), 400

    if not redirect_uri:
        return jsonify({"error": "invalid_request", "error_description": "redirect_uri is required"}), 400

    if redirect_uri not in (client.redirect_uris or []):
        return jsonify({"error": "invalid_request", "error_description": "redirect_uri not registered"}), 400

    requested_scopes = [s.strip() for s in scope.split() if s.strip()] if scope else []
    invalid_scopes = [s for s in requested_scopes if s not in SCOPES]
    if invalid_scopes:
        return jsonify({"error": "invalid_scope", "error_description": f"Invalid scopes: {', '.join(invalid_scopes)}"}), 400

    # Filter to only scopes the client has been granted
    allowed_scopes = [s for s in requested_scopes if s in (client.scopes or [])]

    return jsonify({
        "client": {
            "client_id": client.client_id,
            "name": client.name,
            "description": client.description,
        },
        "scopes": [{"name": s, "description": SCOPES[s]} for s in allowed_scopes],
        "redirect_uri": redirect_uri,
        "state": state,
    }), 200


@api_v1.route("/oauth2/authorize", methods=["POST"])
@jwt_required()
def oauth2_authorize_consent():
    """Process user consent and issue authorization code."""
    data = request.get_json() or {}

    client_id = data.get("client_id")
    redirect_uri = data.get("redirect_uri")
    scopes = data.get("scopes", [])
    state = data.get("state", "")
    approved = data.get("approved", False)
    code_challenge = data.get("code_challenge")
    code_challenge_method = data.get("code_challenge_method", "S256")

    if not client_id:
        return jsonify({"error": "invalid_request", "error_description": "client_id is required"}), 400

    client = OAuthClient.objects(client_id=client_id, active=True).first()
    if not client:
        return jsonify({"error": "invalid_client", "error_description": "Client not found"}), 400

    if not redirect_uri or redirect_uri not in (client.redirect_uris or []):
        return jsonify({"error": "invalid_request", "error_description": "redirect_uri not registered"}), 400

    if not approved:
        return jsonify({
            "redirect_uri": redirect_uri,
            "error": "access_denied",
            "state": state,
        }), 200

    # Generate authorization code
    code = OAuthAuthorizationCode.generate_code()
    auth_code = OAuthAuthorizationCode(
        code=code,
        client=client,
        user=current_user,
        scopes=scopes,
        redirect_uri=redirect_uri,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method if code_challenge else None,
    )
    auth_code.save()

    return jsonify({
        "redirect_uri": redirect_uri,
        "code": code,
        "state": state,
    }), 200


@api_v1.route("/oauth2/token", methods=["POST"])
def oauth2_token():
    """OAuth 2.0 token endpoint. Exchange authorization code for tokens."""
    data = request.get_json() or request.form.to_dict()

    grant_type = data.get("grant_type")
    if grant_type == "authorization_code":
        return _handle_authorization_code(data)
    elif grant_type == "refresh_token":
        return _handle_refresh_token(data)
    else:
        return jsonify({"error": "unsupported_grant_type"}), 400


def _verify_pkce(auth_code, code_verifier):
    """Verify PKCE code_verifier against stored code_challenge."""
    if not auth_code.code_challenge:
        return True  # PKCE not required

    if not code_verifier:
        return False

    if auth_code.code_challenge_method == "S256":
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        computed = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
        return computed == auth_code.code_challenge
    elif auth_code.code_challenge_method == "plain":
        return code_verifier == auth_code.code_challenge

    return False


def _handle_authorization_code(data):
    """Handle authorization_code grant type."""
    code = data.get("code")
    client_id = data.get("client_id")
    client_secret = data.get("client_secret")
    redirect_uri = data.get("redirect_uri")
    code_verifier = data.get("code_verifier")

    if not code or not client_id:
        return jsonify({"error": "invalid_request", "error_description": "code and client_id are required"}), 400

    client = OAuthClient.objects(client_id=client_id, active=True).first()
    if not client:
        return jsonify({"error": "invalid_client"}), 401

    # Verify client secret (not required for public clients using PKCE)
    if client_secret:
        if not client.check_secret(client_secret):
            return jsonify({"error": "invalid_client"}), 401
    elif not code_verifier:
        return jsonify({"error": "invalid_request", "error_description": "client_secret or code_verifier required"}), 400

    auth_code = OAuthAuthorizationCode.objects(code=code, client=client).first()
    if not auth_code:
        return jsonify({"error": "invalid_grant", "error_description": "Invalid authorization code"}), 400

    if auth_code.used:
        return jsonify({"error": "invalid_grant", "error_description": "Authorization code already used"}), 400

    if auth_code.is_expired():
        return jsonify({"error": "invalid_grant", "error_description": "Authorization code expired"}), 400

    if redirect_uri and redirect_uri != auth_code.redirect_uri:
        return jsonify({"error": "invalid_grant", "error_description": "redirect_uri mismatch"}), 400

    # Verify PKCE
    if not _verify_pkce(auth_code, code_verifier):
        return jsonify({"error": "invalid_grant", "error_description": "PKCE verification failed"}), 400

    # Mark code as used
    auth_code.used = True
    auth_code.save()

    # Generate tokens
    access_token_raw = OAuthToken.generate_token()
    refresh_token_raw = OAuthToken.generate_token()

    token = OAuthToken(
        access_token=OAuthToken.hash_token(access_token_raw),
        refresh_token=OAuthToken.hash_token(refresh_token_raw),
        client=client,
        user=auth_code.user,
        scopes=auth_code.scopes,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1),
    )
    token.save()

    return jsonify({
        "access_token": access_token_raw,
        "token_type": "Bearer",
        "expires_in": 3600,
        "refresh_token": refresh_token_raw,
        "scope": " ".join(auth_code.scopes),
    }), 200


def _handle_refresh_token(data):
    """Handle refresh_token grant type."""
    refresh_token_raw = data.get("refresh_token")
    client_id = data.get("client_id")
    client_secret = data.get("client_secret")

    if not refresh_token_raw or not client_id:
        return jsonify({"error": "invalid_request"}), 400

    client = OAuthClient.objects(client_id=client_id, active=True).first()
    if not client:
        return jsonify({"error": "invalid_client"}), 401

    if client_secret and not client.check_secret(client_secret):
        return jsonify({"error": "invalid_client"}), 401

    refresh_hash = OAuthToken.hash_token(refresh_token_raw)
    old_token = OAuthToken.objects(refresh_token=refresh_hash, client=client).first()

    if not old_token or old_token.revoked:
        return jsonify({"error": "invalid_grant", "error_description": "Invalid refresh token"}), 400

    # Revoke old token
    old_token.revoked = True
    old_token.save()

    # Issue new tokens
    new_access_raw = OAuthToken.generate_token()
    new_refresh_raw = OAuthToken.generate_token()

    new_token = OAuthToken(
        access_token=OAuthToken.hash_token(new_access_raw),
        refresh_token=OAuthToken.hash_token(new_refresh_raw),
        client=client,
        user=old_token.user,
        scopes=old_token.scopes,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1),
    )
    new_token.save()

    return jsonify({
        "access_token": new_access_raw,
        "token_type": "Bearer",
        "expires_in": 3600,
        "refresh_token": new_refresh_raw,
        "scope": " ".join(old_token.scopes),
    }), 200


@api_v1.route("/oauth2/revoke", methods=["POST"])
def oauth2_revoke():
    """Revoke an OAuth 2.0 token."""
    data = request.get_json() or request.form.to_dict()
    token_str = data.get("token")

    if not token_str:
        return jsonify({"error": "invalid_request", "error_description": "token is required"}), 400

    token_hash = OAuthToken.hash_token(token_str)

    # Try matching as access token
    token = OAuthToken.objects(access_token=token_hash).first()
    if not token:
        # Try matching as refresh token
        token = OAuthToken.objects(refresh_token=token_hash).first()

    if token:
        token.revoked = True
        token.save()

    # Per RFC 7009, always return 200
    return jsonify({}), 200


@api_v1.route("/oauth2/userinfo", methods=["GET"])
@jwt_required()
def oauth2_userinfo():
    """Get user info (standard OAuth 2.0 userinfo endpoint)."""
    return jsonify({
        "sub": str(current_user.id),
        "email": current_user.email,
        "name": f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        "given_name": current_user.first_name,
        "family_name": current_user.last_name,
    }), 200
