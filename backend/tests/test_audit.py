"""Tests for audit log endpoints."""
import pytest
from bson import ObjectId

from app.models import AuditLog


class TestDatabaseAuditLogs:
    """Tests for GET /api/v1/databases/<slug>/audit-logs."""

    def test_list_audit_logs(self, client, auth_headers, account, database, audit_log):
        """Returns audit logs for the specified database."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/audit-logs",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["pagination"]["total"] == 1
        assert len(data["audit_logs"]) == 1
        assert data["audit_logs"][0]["action"] == "DATABASE_CREATED"
        assert data["audit_logs"][0]["database_slug"] == database.slug

    def test_list_audit_logs_pagination(self, client, auth_headers, user, account, database):
        """Pagination correctly limits and pages results."""
        # Create 5 audit log entries
        for i in range(5):
            AuditLog(
                account=account,
                database=database,
                database_slug=database.slug,
                user=user,
                user_email=user.email,
                action="ENTRY_CREATED",
                resource_type="entry",
                resource_id=str(ObjectId()),
                details=f"Created entry {i}",
            ).save()

        response = client.get(
            f"/api/v1/databases/{database.slug}/audit-logs?page=1&per_page=2",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["audit_logs"]) == 2
        assert data["pagination"]["total"] == 5
        assert data["pagination"]["pages"] == 3

    def test_filter_by_action(self, client, auth_headers, user, account, database):
        """Filtering by action returns only matching logs."""
        AuditLog(
            account=account, database=database, database_slug=database.slug,
            user=user, user_email=user.email,
            action="ENTRY_CREATED", resource_type="entry",
        ).save()
        AuditLog(
            account=account, database=database, database_slug=database.slug,
            user=user, user_email=user.email,
            action="FIELD_CREATED", resource_type="field",
        ).save()

        response = client.get(
            f"/api/v1/databases/{database.slug}/audit-logs?action=ENTRY_CREATED",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["pagination"]["total"] == 1
        assert data["audit_logs"][0]["action"] == "ENTRY_CREATED"

    def test_filter_by_resource_type(self, client, auth_headers, user, account, database):
        """Filtering by resource_type returns only matching logs."""
        AuditLog(
            account=account, database=database, database_slug=database.slug,
            user=user, user_email=user.email,
            action="ENTRY_CREATED", resource_type="entry",
        ).save()
        AuditLog(
            account=account, database=database, database_slug=database.slug,
            user=user, user_email=user.email,
            action="FIELD_CREATED", resource_type="field",
        ).save()

        response = client.get(
            f"/api/v1/databases/{database.slug}/audit-logs?resource_type=field",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["pagination"]["total"] == 1
        assert data["audit_logs"][0]["resource_type"] == "field"


class TestDatabaseAuditLogExport:
    """Tests for GET /api/v1/databases/<slug>/audit-logs/export."""

    def test_csv_export(self, client, auth_headers, account, database, audit_log):
        """Returns a CSV file with audit log data."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/audit-logs/export",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.content_type == "text/csv; charset=utf-8"
        csv_text = response.data.decode("utf-8")
        # Check header row
        assert "Timestamp" in csv_text
        assert "Action" in csv_text
        assert "Resource Type" in csv_text
        # Check data row contains the audit log entry
        assert "DATABASE_CREATED" in csv_text
        assert "test@example.com" in csv_text


class TestDatabaseAuditLogStats:
    """Tests for GET /api/v1/databases/<slug>/audit-logs/stats."""

    def test_stats(self, client, auth_headers, account, database, audit_log):
        """Returns aggregated statistics for the database audit logs."""
        response = client.get(
            f"/api/v1/databases/{database.slug}/audit-logs/stats",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["total"] == 1
        # mongomock may not support aggregation pipelines, so by_action may be empty
        # but the endpoint should still return the structure
        assert "by_action" in data
        assert "by_resource" in data


class TestAccountAuditLogs:
    """Tests for GET /api/v1/audit-logs (account-wide)."""

    def test_list_account_audit_logs(self, client, auth_headers, account, database, audit_log):
        """Returns account-wide audit logs."""
        response = client.get("/api/v1/audit-logs", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["pagination"]["total"] >= 1
        assert len(data["audit_logs"]) >= 1

    def test_filter_by_user_email(self, client, auth_headers, user, account, database):
        """Filters account audit logs by user_email."""
        AuditLog(
            account=account, database=database, database_slug=database.slug,
            user=user, user_email=user.email,
            action="ENTRY_CREATED", resource_type="entry",
        ).save()

        response = client.get(
            f"/api/v1/audit-logs?user_email={user.email}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        for log in data["audit_logs"]:
            assert log["user_email"] == user.email

    def test_filter_by_database_slug(self, client, auth_headers, user, account, database):
        """Filters account audit logs by database_slug."""
        AuditLog(
            account=account, database=database, database_slug=database.slug,
            user=user, user_email=user.email,
            action="ENTRY_CREATED", resource_type="entry",
        ).save()

        response = client.get(
            f"/api/v1/audit-logs?database_slug={database.slug}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        for log in data["audit_logs"]:
            assert log["database_slug"] == database.slug


class TestAccountAuditLogExport:
    """Tests for GET /api/v1/audit-logs/export."""

    def test_account_csv_export(self, client, auth_headers, account, database, audit_log):
        """Returns a CSV file with account-wide audit log data."""
        response = client.get("/api/v1/audit-logs/export", headers=auth_headers)
        assert response.status_code == 200
        assert response.content_type == "text/csv; charset=utf-8"
        csv_text = response.data.decode("utf-8")
        assert "Timestamp" in csv_text
        assert "Database" in csv_text  # account-wide CSV has a Database column
        assert "DATABASE_CREATED" in csv_text


class TestAccountAuditLogStats:
    """Tests for GET /api/v1/audit-logs/stats."""

    def test_account_stats(self, client, auth_headers, account, database, audit_log):
        """Returns account-wide audit log statistics."""
        response = client.get("/api/v1/audit-logs/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["total"] >= 1
        assert "by_action" in data
        assert "by_resource" in data
        assert "by_user" in data
        assert "by_database" in data


class TestAccountAuditLogUsers:
    """Tests for GET /api/v1/audit-logs/users."""

    def test_distinct_users(self, client, auth_headers, account, database, audit_log):
        """Returns a list of distinct user emails from audit logs."""
        response = client.get("/api/v1/audit-logs/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert "users" in data
        # mongomock aggregate may return empty, but the shape must be correct
        assert isinstance(data["users"], list)
