"""Pytest fixtures and configuration."""
import datetime
import pytest
import mongomock
from mongoengine import connect, disconnect

from app import create_app
from app.models import (
    User, Account, AccountMembership, ResourcePermissions, Permissions,
    Database, Field, Entry, Subscription, Visualization,
    AuditLog, Notification, NotificationPreference, NotificationChannel,
    OAuthClient, OAuthAuthorizationCode, OAuthToken,
)


@pytest.fixture(scope="function")
def app():
    """Create application for testing."""
    disconnect()
    app = create_app("testing")
    app.config["TESTING"] = True
    yield app

    # Cleanup all collections
    for model in [
        OAuthToken, OAuthAuthorizationCode, OAuthClient,
        NotificationPreference, Notification, AuditLog,
        Visualization, Entry, Field, Database,
        Subscription, AccountMembership, Account, User,
    ]:
        try:
            model.drop_collection()
        except Exception:
            pass
    disconnect()


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def user(app):
    """Create a test user."""
    user = User(
        email="test@example.com",
        first_name="Test",
        last_name="User",
    )
    user.set_password("password123")
    user.save()
    return user


@pytest.fixture
def auth_headers(client, user):
    """Get authentication headers for test user."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    data = response.get_json()
    return {"Authorization": f"Bearer {data['access_token']}"}


@pytest.fixture
def account(user):
    """Create a test account with admin membership."""
    account = Account(name="Test Workspace", owner=user)
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
    return account


@pytest.fixture
def pro_subscription(account):
    """Create an active Pro subscription for the test account."""
    sub = Subscription(
        account=account,
        stripe_subscription_id="sub_test_123",
        stripe_price_id="price_test_123",
        status="active",
    )
    sub.save()
    return sub


@pytest.fixture
def database(user, account):
    """Create a test database."""
    db = Database(
        title="Test Database",
        slug="test-database",
        description="A test database",
        user=user,
        account=account,
    )
    db.save()
    return db


@pytest.fixture
def field(database):
    """Create a test field."""
    field = Field(
        database=database,
        name="test_field",
        field_type="STR",
        required=True,
        order=0,
    )
    field.save()
    return field


@pytest.fixture
def entry(database):
    """Create a test entry."""
    entry = Entry(
        database=database,
        values={"test_field": "test_value"},
    )
    entry.save()
    return entry


# --- New fixtures for expanded test coverage ---


@pytest.fixture
def second_user(app):
    """Create a second test user."""
    user = User(
        email="member@example.com",
        first_name="Member",
        last_name="User",
    )
    user.set_password("password123")
    user.save()
    return user


@pytest.fixture
def member_membership(account, second_user, user):
    """Create a member-level membership for second_user in the test account."""
    membership = AccountMembership(
        account=account,
        user=second_user,
        role="member",
        permissions=ResourcePermissions.from_role("member"),
        status="active",
        invited_by=user,
        invited_at=datetime.datetime.utcnow(),
        accepted_at=datetime.datetime.utcnow(),
    )
    membership.save()
    second_user.active_account = account
    second_user.save()
    return membership


@pytest.fixture
def member_auth_headers(client, second_user, member_membership):
    """Get authentication headers for member user."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "member@example.com", "password": "password123"},
    )
    data = response.get_json()
    return {"Authorization": f"Bearer {data['access_token']}"}


@pytest.fixture
def visualization(user, database):
    """Create a test visualization."""
    viz = Visualization(
        user=user,
        title="Test Chart",
        chart_type="bar",
        database_slugs=[database.slug],
        x_field="test_field",
        aggregation="count",
    )
    viz.save()
    return viz


@pytest.fixture
def notification(user, account):
    """Create a test notification."""
    n = Notification(
        user=user,
        account=account,
        notification_type="database_created",
        title="Test notification",
        message="A test notification message",
        link="/dashboard",
        actor_email="other@example.com",
    )
    n.save()
    return n


@pytest.fixture
def notification_preference(user):
    """Create test notification preferences."""
    prefs = NotificationPreference(
        user=user,
        email_enabled=True,
        team_invites=NotificationChannel(in_app=True, email=True),
        database_changes=NotificationChannel(in_app=True, email=False),
        entry_modifications=NotificationChannel(in_app=False, email=False),
        field_changes=NotificationChannel(in_app=True, email=False),
    )
    prefs.save()
    return prefs


@pytest.fixture
def audit_log(user, account, database):
    """Create a test audit log entry."""
    log = AuditLog(
        account=account,
        database=database,
        database_slug=database.slug,
        user=user,
        user_email=user.email,
        action="DATABASE_CREATED",
        resource_type="database",
        resource_id=str(database.id),
        resource_name=database.title,
        details="Created database 'Test Database'",
    )
    log.save()
    return log


@pytest.fixture
def oauth_client(user, account):
    """Create a test OAuth client."""
    oc = OAuthClient(
        client_id="test-client-id",
        name="Test OAuth App",
        description="A test OAuth application",
        redirect_uris=["http://localhost:3000/callback"],
        scopes=["read:user", "read:databases"],
        user=user,
        account=account,
    )
    oc.set_secret("test-client-secret")
    oc.save()
    return oc


@pytest.fixture
def oauth_authorization_code(oauth_client, user):
    """Create a test OAuth authorization code."""
    code = OAuthAuthorizationCode(
        code="test-auth-code-12345",
        client=oauth_client,
        user=user,
        scopes=["read:user", "read:databases"],
        redirect_uri="http://localhost:3000/callback",
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
    )
    code.save()
    return code
