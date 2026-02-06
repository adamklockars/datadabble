"""OAuth social login endpoints."""
import secrets
import requests as http_requests
from flask import jsonify, request, current_app
from flask_jwt_extended import create_access_token, create_refresh_token
from authlib.integrations.requests_client import OAuth2Session

from app.api.v1 import api_v1
from app.api.schemas import UserSchema
from app.models import User, Account, AccountMembership, ResourcePermissions, SocialAccount


OAUTH_CONFIGS = {
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
    },
    "github": {
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scope": "read:user user:email",
    },
}


def _get_oauth_config(provider):
    """Get OAuth client credentials for a provider."""
    provider_upper = provider.upper()
    client_id = current_app.config.get(f"{provider_upper}_CLIENT_ID", "")
    client_secret = current_app.config.get(f"{provider_upper}_CLIENT_SECRET", "")
    redirect_uri = current_app.config.get(f"{provider_upper}_REDIRECT_URI", "")
    return client_id, client_secret, redirect_uri


def _get_google_user_info(token):
    """Fetch user info from Google."""
    resp = http_requests.get(
        OAUTH_CONFIGS["google"]["userinfo_url"],
        headers={"Authorization": f"Bearer {token['access_token']}"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "provider_user_id": data["sub"],
        "email": data.get("email", ""),
        "name": data.get("name", ""),
        "avatar_url": data.get("picture", ""),
    }


def _get_github_user_info(token):
    """Fetch user info from GitHub."""
    headers = {"Authorization": f"Bearer {token['access_token']}"}

    # Get user profile
    resp = http_requests.get(
        OAUTH_CONFIGS["github"]["userinfo_url"],
        headers=headers,
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    email = data.get("email") or ""

    # If email is not public, fetch from emails endpoint
    if not email:
        emails_resp = http_requests.get(
            "https://api.github.com/user/emails",
            headers=headers,
            timeout=10,
        )
        if emails_resp.ok:
            emails = emails_resp.json()
            primary = next((e for e in emails if e.get("primary")), None)
            if primary:
                email = primary["email"]
            elif emails:
                email = emails[0]["email"]

    return {
        "provider_user_id": str(data["id"]),
        "email": email,
        "name": data.get("name") or data.get("login", ""),
        "avatar_url": data.get("avatar_url", ""),
    }


def _find_or_create_user(provider, user_info):
    """Find existing user or create a new one from OAuth user info."""
    email = user_info["email"].lower()
    if not email:
        return None, "No email provided by OAuth provider"

    user = User.objects(email=email).first()

    social_data = SocialAccount(
        provider=provider,
        provider_user_id=user_info["provider_user_id"],
        email=user_info["email"],
        name=user_info["name"],
        avatar_url=user_info["avatar_url"],
    )

    if user:
        # Link social account if not already linked
        existing_social = next(
            (sa for sa in (user.social_accounts or [])
             if sa.provider == provider and sa.provider_user_id == user_info["provider_user_id"]),
            None
        )
        if not existing_social:
            if user.social_accounts is None:
                user.social_accounts = []
            user.social_accounts.append(social_data)

        # If user was pending (invited), complete registration
        if user.password_hash == "pending":
            user.password_hash = "social_auth_only"
            if not user.first_name and user_info["name"]:
                name_parts = user_info["name"].split(" ", 1)
                user.first_name = name_parts[0]
                user.last_name = name_parts[1] if len(name_parts) > 1 else ""

            # Activate pending memberships
            pending_memberships = AccountMembership.objects(user=user, status="pending")
            for membership in pending_memberships:
                membership.status = "active"
                membership.save()

        user.save()

        # Ensure user has an active account
        if not user.active_account:
            existing_membership = AccountMembership.objects(user=user, status="active").first()
            if existing_membership:
                user.active_account = existing_membership.account
            else:
                _create_default_account(user, user_info)
            user.save()

        return user, None

    # Create new user
    name_parts = user_info["name"].split(" ", 1) if user_info["name"] else ["", ""]
    user = User(
        email=email,
        first_name=name_parts[0],
        last_name=name_parts[1] if len(name_parts) > 1 else "",
        password_hash="social_auth_only",
        social_accounts=[social_data],
    )
    user.save()

    _create_default_account(user, user_info)
    user.save()

    return user, None


def _create_default_account(user, user_info):
    """Create a default account and admin membership for a new user."""
    account_name = f"{user.first_name or user.email.split('@')[0]}'s Workspace"
    account = Account(name=account_name, owner=user)
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


@api_v1.route("/auth/oauth/<provider>/authorize", methods=["GET"])
def oauth_authorize(provider):
    """Return the OAuth authorization URL for the given provider."""
    if provider not in OAUTH_CONFIGS:
        return jsonify({"error": f"Unsupported provider: {provider}"}), 400

    client_id, client_secret, redirect_uri = _get_oauth_config(provider)
    if not client_id or not client_secret:
        return jsonify({"error": f"{provider} OAuth is not configured"}), 400

    config = OAUTH_CONFIGS[provider]
    state = secrets.token_urlsafe(32)

    session = OAuth2Session(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope=config["scope"],
    )

    authorization_url, _ = session.create_authorization_url(
        config["authorize_url"],
        state=state,
    )

    return jsonify({
        "authorization_url": authorization_url,
        "state": state,
    }), 200


@api_v1.route("/auth/oauth/<provider>/callback", methods=["POST"])
def oauth_callback(provider):
    """Exchange auth code for tokens and create/link user."""
    if provider not in OAUTH_CONFIGS:
        return jsonify({"error": f"Unsupported provider: {provider}"}), 400

    client_id, client_secret, redirect_uri = _get_oauth_config(provider)
    if not client_id or not client_secret:
        return jsonify({"error": f"{provider} OAuth is not configured"}), 400

    data = request.get_json() or {}
    code = data.get("code")
    if not code:
        return jsonify({"error": "Authorization code is required"}), 400

    config = OAUTH_CONFIGS[provider]

    # Exchange code for token
    try:
        session = OAuth2Session(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
        )

        token = session.fetch_token(
            config["token_url"],
            code=code,
            grant_type="authorization_code",
        )
    except Exception:
        return jsonify({"error": "Failed to exchange authorization code"}), 400

    # Fetch user info
    try:
        if provider == "google":
            user_info = _get_google_user_info(token)
        elif provider == "github":
            user_info = _get_github_user_info(token)
        else:
            return jsonify({"error": "Unsupported provider"}), 400
    except Exception:
        return jsonify({"error": "Failed to fetch user info from provider"}), 400

    # Find or create user
    user, error = _find_or_create_user(provider, user_info)
    if error:
        return jsonify({"error": error}), 400

    # Generate JWT tokens
    access_token = create_access_token(identity=user)
    refresh_token = create_refresh_token(identity=user)

    return jsonify({
        "message": "OAuth login successful",
        "user": UserSchema().dump(user.to_dict()),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 200
