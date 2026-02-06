"""Tests for the audit helper module."""
import pytest
from app.models import AuditLog
from app.api.v1.audit_helper import log_action, compute_changes, serialize_for_audit


class TestLogAction:
    """Tests for log_action function."""

    def test_creates_audit_log_with_correct_fields(self, app, user, account, database):
        """log_action creates an AuditLog with all provided fields set correctly."""
        with app.app_context():
            result = log_action(
                database=database,
                user=user,
                action="DATABASE_CREATED",
                resource_type="database",
                resource_id=str(database.id),
                resource_name=database.title,
                details="Created database 'Test Database'",
                account=account,
            )

            assert isinstance(result, AuditLog)
            assert result.id is not None
            assert result.action == "DATABASE_CREATED"
            assert result.resource_type == "database"
            assert result.resource_name == "Test Database"
            assert result.user_email == user.email
            assert result.database_slug == database.slug
            assert str(result.account.id) == str(account.id)
            assert result.details == "Created database 'Test Database'"

    def test_explicit_database_slug_override(self, app, user, account, database):
        """When database_slug is explicitly provided, it overrides the database's slug."""
        with app.app_context():
            result = log_action(
                database=database,
                user=user,
                action="DATABASE_DELETED",
                resource_type="database",
                resource_id=str(database.id),
                resource_name=database.title,
                database_slug="custom-slug-override",
                account=account,
            )

            assert result.database_slug == "custom-slug-override"

    def test_no_database_sets_slug_to_deleted(self, app, user, account):
        """When database is None and no slug override, slug defaults to 'deleted'."""
        with app.app_context():
            result = log_action(
                database=None,
                user=user,
                action="DATABASE_DELETED",
                resource_type="database",
                resource_id="some-id",
                resource_name="Gone Database",
                account=account,
            )

            assert result.database_slug == "deleted"
            assert result.database is None


class TestComputeChanges:
    """Tests for compute_changes function."""

    def test_detects_differences(self):
        """compute_changes correctly identifies changed, added, and removed fields."""
        previous = {"title": "Old Title", "description": "Old desc", "color": "red"}
        new = {"title": "New Title", "description": "Old desc", "status": "active"}

        changes = compute_changes(previous, new)

        assert changes is not None
        assert changes["title"] == {"from": "Old Title", "to": "New Title"}
        # "color" was removed (present in previous, not in new)
        assert changes["color"] == {"from": "red", "to": None}
        # "status" was added (not in previous, present in new)
        assert changes["status"] == {"from": None, "to": "active"}
        # "description" is unchanged, should not be in changes
        assert "description" not in changes

    def test_returns_none_when_identical(self):
        """compute_changes returns None when both states are identical."""
        state = {"title": "Same", "count": 42}
        result = compute_changes(state, state.copy())
        assert result is None


class TestSerializeForAudit:
    """Tests for serialize_for_audit function."""

    def test_excludes_timestamps_and_specified_fields(self):
        """serialize_for_audit removes created_at, updated_at, and custom excluded fields."""
        data = {
            "id": "abc123",
            "title": "My DB",
            "created_at": "2025-01-01T00:00:00",
            "updated_at": "2025-01-02T00:00:00",
            "password_hash": "secret",
        }

        result = serialize_for_audit(data, exclude_fields=["password_hash"])

        assert "created_at" not in result
        assert "updated_at" not in result
        assert "password_hash" not in result
        assert result["id"] == "abc123"
        assert result["title"] == "My DB"

    def test_returns_none_for_none_input(self):
        """serialize_for_audit returns None when obj is None."""
        result = serialize_for_audit(None)
        assert result is None
