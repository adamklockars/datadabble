"""Tests for visualization endpoints (prefix: /api/v1)."""
import pytest
from bson import ObjectId

from app.models import Database, Entry, Visualization


class TestListVisualizations:
    """Tests for GET /api/v1/visualizations."""

    def test_list_empty(self, client, auth_headers, account):
        """Returns empty list when user has no visualizations."""
        response = client.get("/api/v1/visualizations", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data == []

    def test_list_with_data(self, client, auth_headers, account, visualization):
        """Returns all visualizations belonging to the user."""
        response = client.get("/api/v1/visualizations", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert len(data) == 1
        assert data[0]["title"] == "Test Chart"
        assert data[0]["chart_type"] == "bar"


class TestCreateVisualization:
    """Tests for POST /api/v1/visualizations."""

    def test_create_bar_chart(self, client, auth_headers, account, database, app):
        """Successfully creates a bar chart visualization."""
        app.config["FREE_TIER_MAX_VISUALIZATIONS"] = 100
        response = client.post(
            "/api/v1/visualizations",
            headers=auth_headers,
            json={
                "title": "Sales by Category",
                "chart_type": "bar",
                "database_slugs": [database.slug],
                "x_field": "test_field",
                "aggregation": "count",
            },
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["title"] == "Sales by Category"
        assert data["chart_type"] == "bar"
        assert data["aggregation"] == "count"
        assert database.slug in data["database_slugs"]

    def test_create_pie_chart(self, client, auth_headers, account, database, app):
        """Successfully creates a pie chart visualization."""
        app.config["FREE_TIER_MAX_VISUALIZATIONS"] = 100
        response = client.post(
            "/api/v1/visualizations",
            headers=auth_headers,
            json={
                "title": "Distribution",
                "chart_type": "pie",
                "database_slugs": [database.slug],
                "x_field": "test_field",
            },
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["chart_type"] == "pie"

    def test_create_validation_errors(self, client, auth_headers, account, app):
        """Returns 400 for missing required fields."""
        app.config["FREE_TIER_MAX_VISUALIZATIONS"] = 100
        response = client.post(
            "/api/v1/visualizations",
            headers=auth_headers,
            json={"title": "Missing chart_type"},
        )
        assert response.status_code == 400
        data = response.get_json()
        assert "messages" in data or "error" in data

    def test_create_invalid_database_slug(self, client, auth_headers, account, app):
        """Returns 404 when referencing a nonexistent database slug."""
        app.config["FREE_TIER_MAX_VISUALIZATIONS"] = 100
        response = client.post(
            "/api/v1/visualizations",
            headers=auth_headers,
            json={
                "title": "Bad Slug",
                "chart_type": "bar",
                "database_slugs": ["nonexistent-db"],
                "x_field": "some_field",
            },
        )
        assert response.status_code == 404
        data = response.get_json()
        assert "not found" in data["error"].lower()


class TestGetVisualization:
    """Tests for GET /api/v1/visualizations/<id>."""

    def test_get_existing(self, client, auth_headers, account, visualization):
        """Returns the visualization by ID."""
        viz_id = str(visualization.id)
        response = client.get(f"/api/v1/visualizations/{viz_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["id"] == viz_id
        assert data["title"] == "Test Chart"

    def test_get_not_found(self, client, auth_headers, account):
        """Returns 404 for a nonexistent visualization ID."""
        fake_id = str(ObjectId())
        response = client.get(f"/api/v1/visualizations/{fake_id}", headers=auth_headers)
        assert response.status_code == 404

    def test_get_invalid_id(self, client, auth_headers, account):
        """Returns 400 for a malformed visualization ID."""
        response = client.get("/api/v1/visualizations/not-a-valid-id", headers=auth_headers)
        assert response.status_code == 400
        data = response.get_json()
        assert "invalid" in data["error"].lower()


class TestUpdateVisualization:
    """Tests for PUT /api/v1/visualizations/<id>."""

    def test_update_title(self, client, auth_headers, account, visualization):
        """Successfully updates the visualization title."""
        viz_id = str(visualization.id)
        response = client.put(
            f"/api/v1/visualizations/{viz_id}",
            headers=auth_headers,
            json={"title": "Updated Chart Title"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["title"] == "Updated Chart Title"

    def test_update_chart_type(self, client, auth_headers, account, visualization):
        """Successfully updates the chart type."""
        viz_id = str(visualization.id)
        response = client.put(
            f"/api/v1/visualizations/{viz_id}",
            headers=auth_headers,
            json={"chart_type": "pie"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["chart_type"] == "pie"

    def test_update_not_found(self, client, auth_headers, account):
        """Returns 404 when updating a nonexistent visualization."""
        fake_id = str(ObjectId())
        response = client.put(
            f"/api/v1/visualizations/{fake_id}",
            headers=auth_headers,
            json={"title": "Nope"},
        )
        assert response.status_code == 404


class TestDeleteVisualization:
    """Tests for DELETE /api/v1/visualizations/<id>."""

    def test_delete_existing(self, client, auth_headers, account, visualization):
        """Successfully deletes the visualization."""
        viz_id = str(visualization.id)
        response = client.delete(f"/api/v1/visualizations/{viz_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert "deleted" in data["message"].lower()
        # Confirm it is gone
        assert Visualization.objects(id=viz_id).first() is None

    def test_delete_not_found(self, client, auth_headers, account):
        """Returns 404 when deleting a nonexistent visualization."""
        fake_id = str(ObjectId())
        response = client.delete(f"/api/v1/visualizations/{fake_id}", headers=auth_headers)
        assert response.status_code == 404


class TestGetVisualizationData:
    """Tests for GET /api/v1/visualizations/<id>/data."""

    def test_get_data_count_aggregation(self, client, auth_headers, account, visualization, database):
        """Returns chart data with count aggregation for saved visualization."""
        viz_id = str(visualization.id)
        response = client.get(f"/api/v1/visualizations/{viz_id}/data", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert "labels" in data
        assert "series" in data
        assert data["chart_type"] == "bar"
        assert data["aggregation"] == "count"

    def test_get_data_with_entries(self, client, auth_headers, user, account, database, entry, app):
        """Returns aggregated data when database has entries."""
        app.config["FREE_TIER_MAX_VISUALIZATIONS"] = 100
        # Create additional entries with varying values
        Entry(database=database, values={"test_field": "alpha"}).save()
        Entry(database=database, values={"test_field": "beta"}).save()
        Entry(database=database, values={"test_field": "alpha"}).save()

        viz = Visualization(
            user=user,
            title="Entry Chart",
            chart_type="bar",
            database_slugs=[database.slug],
            x_field="test_field",
            aggregation="count",
        )
        viz.save()

        viz_id = str(viz.id)
        response = client.get(f"/api/v1/visualizations/{viz_id}/data", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["series"]) == 1
        series_data = data["series"][0]["data"]
        # We should have buckets for alpha, beta, and test_value (from entry fixture)
        names = [point["name"] for point in series_data]
        assert "alpha" in names
        assert "beta" in names


class TestAdHocVisualizationData:
    """Tests for POST /api/v1/visualizations/data."""

    def test_ad_hoc_data(self, client, auth_headers, account, database, entry):
        """Returns chart data for ad-hoc configuration."""
        response = client.post(
            "/api/v1/visualizations/data",
            headers=auth_headers,
            json={
                "database_slugs": [database.slug],
                "x_field": "test_field",
                "aggregation": "count",
            },
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "labels" in data
        assert "series" in data
        assert len(data["series"]) == 1
        assert data["series"][0]["database_slug"] == database.slug

    def test_ad_hoc_missing_params(self, client, auth_headers, account):
        """Returns 400 when required parameters are missing."""
        response = client.post(
            "/api/v1/visualizations/data",
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 400
        data = response.get_json()
        assert "required" in data["error"].lower()
