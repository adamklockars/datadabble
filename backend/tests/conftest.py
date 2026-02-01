"""Pytest fixtures and configuration."""
import pytest
import mongomock
from mongoengine import connect, disconnect

from app import create_app
from app.models import User, Database, Field, Entry


@pytest.fixture(scope="function")
def app():
    """Create application for testing."""
    # Disconnect any existing connections
    disconnect()

    # Connect to mongomock
    connect("datadabble_test", mongo_client_class=mongomock.MongoClient)

    app = create_app("testing")
    app.config["TESTING"] = True

    yield app

    # Cleanup
    User.drop_collection()
    Database.drop_collection()
    Field.drop_collection()
    Entry.drop_collection()
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
def database(user):
    """Create a test database."""
    db = Database(
        title="Test Database",
        slug="test-database",
        description="A test database",
        user=user,
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
