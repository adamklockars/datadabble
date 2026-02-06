"""Tests for billing endpoints and plan limit enforcement."""
import json
import datetime
from unittest.mock import patch, MagicMock

import pytest
from app.models import (
    User, Account, AccountMembership, ResourcePermissions,
    Database, Field, Entry, Subscription, Visualization,
)


class TestBillingPlans:
    """Test GET /billing/plans (public endpoint)."""

    def test_get_plans_without_stripe(self, client, app):
        """Returns free limits and empty prices when Stripe is not configured."""
        response = client.get("/api/v1/billing/plans")
        assert response.status_code == 200
        data = response.get_json()
        assert data["free"]["name"] == "Free"
        assert data["free"]["limits"]["max_databases"] == 3
        assert data["pro"]["name"] == "Pro"
        assert data["pro"]["prices"] == []
        assert data["pro"]["limits"]["max_databases"] is None

    @patch("stripe.Price.list")
    def test_get_plans_with_stripe(self, mock_price_list, client, app):
        """Returns prices from Stripe when configured."""
        app.config["STRIPE_SECRET_KEY"] = "sk_test_123"
        app.config["STRIPE_PRO_PRODUCT_ID"] = "prod_test_123"

        mock_price = MagicMock()
        mock_price.id = "price_monthly"
        mock_price.currency = "usd"
        mock_price.unit_amount = 1999
        mock_price.recurring = MagicMock(interval="month", interval_count=1)
        mock_product = MagicMock()
        mock_product.name = "Pro"
        mock_price.product = mock_product

        mock_price_list.return_value = MagicMock(data=[mock_price])

        response = client.get("/api/v1/billing/plans")
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["pro"]["prices"]) == 1
        assert data["pro"]["prices"][0]["id"] == "price_monthly"
        assert data["pro"]["prices"][0]["unit_amount"] == 1999
        assert data["pro"]["prices"][0]["interval"] == "month"


class TestBillingSubscription:
    """Test GET /billing/subscription."""

    def test_get_subscription_free(self, client, auth_headers, account):
        """Returns free plan for accounts without subscription."""
        response = client.get("/api/v1/billing/subscription", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["plan"] == "free"
        assert data["limits"]["max_databases"] == 3
        assert data["subscription"] is None

    def test_get_subscription_pro(self, client, auth_headers, account, pro_subscription):
        """Returns pro plan for accounts with active subscription."""
        response = client.get("/api/v1/billing/subscription", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["plan"] == "pro"
        assert data["limits"]["max_databases"] is None
        assert data["subscription"] is not None
        assert data["subscription"]["status"] == "active"
        assert data["subscription"]["is_pro"] is True


class TestBillingCheckout:
    """Test POST /billing/checkout."""

    @patch("stripe.checkout.Session.create")
    @patch("stripe.Customer.create")
    def test_create_checkout_session(self, mock_customer, mock_session, client, auth_headers, account, app):
        """Creates a Stripe checkout session."""
        app.config["STRIPE_SECRET_KEY"] = "sk_test_123"

        mock_customer.return_value = MagicMock(id="cus_test_123")
        mock_session.return_value = MagicMock(url="https://checkout.stripe.com/session123")

        response = client.post(
            "/api/v1/billing/checkout",
            headers=auth_headers,
            json={"price_id": "price_monthly"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "checkout_url" in data
        assert data["checkout_url"] == "https://checkout.stripe.com/session123"

    def test_create_checkout_requires_price_id(self, client, auth_headers, account, app):
        """Returns 400 if price_id is missing."""
        app.config["STRIPE_SECRET_KEY"] = "sk_test_123"

        response = client.post(
            "/api/v1/billing/checkout",
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 400
        assert "price_id" in response.get_json()["error"]


class TestBillingPortal:
    """Test POST /billing/portal."""

    @patch("stripe.billing_portal.Session.create")
    def test_create_portal_session(self, mock_portal, client, auth_headers, account, app):
        """Creates a Stripe portal session for accounts with customer ID."""
        app.config["STRIPE_SECRET_KEY"] = "sk_test_123"
        account.stripe_customer_id = "cus_test_123"
        account.save()

        mock_portal.return_value = MagicMock(url="https://billing.stripe.com/portal123")

        response = client.post("/api/v1/billing/portal", headers=auth_headers)
        assert response.status_code == 200
        assert response.get_json()["portal_url"] == "https://billing.stripe.com/portal123"

    def test_create_portal_no_customer(self, client, auth_headers, account, app):
        """Returns error when account has no Stripe customer."""
        app.config["STRIPE_SECRET_KEY"] = "sk_test_123"

        response = client.post("/api/v1/billing/portal", headers=auth_headers)
        assert response.status_code == 400


class TestWebhooks:
    """Test POST /billing/webhooks."""

    @patch("stripe.Webhook.construct_event")
    def test_subscription_created_webhook(self, mock_construct, client, account, app):
        """Handles customer.subscription.created event."""
        app.config["STRIPE_WEBHOOK_SECRET"] = "whsec_test_123"
        app.config["STRIPE_SECRET_KEY"] = "sk_test_123"

        account.stripe_customer_id = "cus_test_456"
        account.save()

        mock_construct.return_value = {
            "type": "customer.subscription.created",
            "data": {
                "object": {
                    "id": "sub_new_123",
                    "customer": "cus_test_456",
                    "status": "active",
                    "current_period_start": 1700000000,
                    "current_period_end": 1702592000,
                    "cancel_at_period_end": False,
                    "items": {"data": [{"price": {"id": "price_m_123"}}]},
                },
            },
        }

        response = client.post(
            "/api/v1/billing/webhooks",
            data="{}",
            headers={"Stripe-Signature": "sig_test"},
            content_type="application/json",
        )
        assert response.status_code == 200

        sub = Subscription.objects(account=account).first()
        assert sub is not None
        assert sub.stripe_subscription_id == "sub_new_123"
        assert sub.status == "active"

    @patch("stripe.Webhook.construct_event")
    def test_subscription_deleted_webhook(self, mock_construct, client, account, pro_subscription, app):
        """Handles customer.subscription.deleted event."""
        app.config["STRIPE_WEBHOOK_SECRET"] = "whsec_test_123"
        app.config["STRIPE_SECRET_KEY"] = "sk_test_123"

        mock_construct.return_value = {
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_test_123",
                    "customer": "cus_test_456",
                    "status": "canceled",
                },
            },
        }

        response = client.post(
            "/api/v1/billing/webhooks",
            data="{}",
            headers={"Stripe-Signature": "sig_test"},
            content_type="application/json",
        )
        assert response.status_code == 200

        pro_subscription.reload()
        assert pro_subscription.status == "canceled"

    @patch("stripe.Webhook.construct_event")
    def test_invoice_payment_failed_webhook(self, mock_construct, client, account, pro_subscription, app):
        """Handles invoice.payment_failed event."""
        app.config["STRIPE_WEBHOOK_SECRET"] = "whsec_test_123"
        app.config["STRIPE_SECRET_KEY"] = "sk_test_123"

        mock_construct.return_value = {
            "type": "invoice.payment_failed",
            "data": {
                "object": {
                    "subscription": "sub_test_123",
                },
            },
        }

        response = client.post(
            "/api/v1/billing/webhooks",
            data="{}",
            headers={"Stripe-Signature": "sig_test"},
            content_type="application/json",
        )
        assert response.status_code == 200

        pro_subscription.reload()
        assert pro_subscription.status == "past_due"

    def test_webhook_missing_secret(self, client, app):
        """Returns 500 when webhook secret is not configured."""
        app.config["STRIPE_WEBHOOK_SECRET"] = ""
        app.config["STRIPE_SECRET_KEY"] = "sk_test_123"

        response = client.post(
            "/api/v1/billing/webhooks",
            data="{}",
            headers={"Stripe-Signature": "sig_test"},
            content_type="application/json",
        )
        assert response.status_code == 500


class TestPlanLimits:
    """Test plan limit enforcement on resource creation."""

    def test_database_limit_enforced(self, client, auth_headers, user, account, app):
        """Free plan enforces database creation limit."""
        app.config["FREE_TIER_MAX_DATABASES"] = 2

        # Create up to limit
        for i in range(2):
            response = client.post(
                "/api/v1/databases",
                headers=auth_headers,
                json={"title": f"DB {i}"},
            )
            assert response.status_code == 201

        # Next creation should fail
        response = client.post(
            "/api/v1/databases",
            headers=auth_headers,
            json={"title": "DB over limit"},
        )
        assert response.status_code == 403
        data = response.get_json()
        assert data["error"] == "Plan limit reached"
        assert data["limit_type"] == "database"
        assert data["limit"] == 2

    def test_database_limit_bypassed_pro(self, client, auth_headers, user, account, pro_subscription, app):
        """Pro plan bypasses database creation limit."""
        app.config["FREE_TIER_MAX_DATABASES"] = 2

        for i in range(3):
            response = client.post(
                "/api/v1/databases",
                headers=auth_headers,
                json={"title": f"Pro DB {i}"},
            )
            assert response.status_code == 201

    def test_field_limit_enforced(self, client, auth_headers, user, account, database, app):
        """Free plan enforces field creation limit per database."""
        app.config["FREE_TIER_MAX_FIELDS_PER_DB"] = 2

        for i in range(2):
            response = client.post(
                f"/api/v1/databases/{database.slug}/fields",
                headers=auth_headers,
                json={"name": f"field_{i}", "field_type": "STR"},
            )
            assert response.status_code == 201

        response = client.post(
            f"/api/v1/databases/{database.slug}/fields",
            headers=auth_headers,
            json={"name": "field_over_limit", "field_type": "STR"},
        )
        assert response.status_code == 403
        assert response.get_json()["limit_type"] == "field"

    def test_entry_limit_enforced(self, client, auth_headers, user, account, database, field, app):
        """Free plan enforces entry creation limit per database."""
        app.config["FREE_TIER_MAX_ENTRIES_PER_DB"] = 2

        for i in range(2):
            response = client.post(
                f"/api/v1/databases/{database.slug}/entries",
                headers=auth_headers,
                json={"values": {"test_field": f"val_{i}"}},
            )
            assert response.status_code == 201

        response = client.post(
            f"/api/v1/databases/{database.slug}/entries",
            headers=auth_headers,
            json={"values": {"test_field": "over_limit"}},
        )
        assert response.status_code == 403
        assert response.get_json()["limit_type"] == "entry"

    def test_entry_limit_bypassed_pro(self, client, auth_headers, user, account, pro_subscription, database, field, app):
        """Pro plan bypasses entry creation limit."""
        app.config["FREE_TIER_MAX_ENTRIES_PER_DB"] = 2

        for i in range(3):
            response = client.post(
                f"/api/v1/databases/{database.slug}/entries",
                headers=auth_headers,
                json={"values": {"test_field": f"pro_val_{i}"}},
            )
            assert response.status_code == 201


class TestAuthMePlanInfo:
    """Test that /auth/me includes plan information."""

    def test_auth_me_includes_plan(self, client, auth_headers, account):
        """GET /auth/me returns plan and plan_limits."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert "plan" in data
        assert "plan_limits" in data
        assert data["plan"] == "free"
        assert data["plan_limits"]["max_databases"] == 3

    def test_auth_me_pro_plan(self, client, auth_headers, account, pro_subscription):
        """GET /auth/me returns pro plan when subscription is active."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["plan"] == "pro"
        assert data["plan_limits"]["max_databases"] is None
