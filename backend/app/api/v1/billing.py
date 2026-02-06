"""Billing and subscription endpoints."""
import datetime
import stripe
from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, current_user

from app.api.v1 import api_v1
from app.api.v1.permissions import require_admin
from app.api.v1.plan_limits import get_account_plan, get_plan_limits, get_account_usage
from app.models import Account, Subscription


def _init_stripe():
    """Set stripe API key from app config."""
    stripe.api_key = current_app.config.get("STRIPE_SECRET_KEY", "")


# --- Public endpoint ---

@api_v1.route("/billing/plans", methods=["GET"])
def get_plans():
    """Fetch active prices for the Pro product from Stripe + free tier limits."""
    _init_stripe()
    product_id = current_app.config.get("STRIPE_PRO_PRODUCT_ID", "")
    free_limits = get_plan_limits("free")

    prices = []
    if product_id and stripe.api_key:
        try:
            stripe_prices = stripe.Price.list(
                product=product_id, active=True, expand=["data.product"]
            )
            for p in stripe_prices.data:
                prices.append({
                    "id": p.id,
                    "currency": p.currency,
                    "unit_amount": p.unit_amount,
                    "interval": p.recurring.interval if p.recurring else None,
                    "interval_count": p.recurring.interval_count if p.recurring else None,
                    "product_name": p.product.name if hasattr(p.product, "name") else "Pro",
                })
        except stripe.StripeError:
            # If Stripe is not configured, return empty prices
            pass

    return jsonify({
        "free": {
            "name": "Free",
            "limits": free_limits,
        },
        "pro": {
            "name": "Pro",
            "prices": prices,
            "limits": get_plan_limits("pro"),
        },
    }), 200


# --- Authenticated endpoints ---

@api_v1.route("/billing/subscription", methods=["GET"])
@jwt_required()
def get_subscription():
    """Get current account's plan, limits, usage, and subscription details."""
    account = current_user.active_account
    plan = get_account_plan(account)
    limits = get_plan_limits(plan)
    usage = get_account_usage(account)

    sub = None
    if account:
        sub_obj = Subscription.objects(account=account).first()
        if sub_obj:
            sub = sub_obj.to_dict()

    return jsonify({
        "plan": plan,
        "limits": limits,
        "usage": usage,
        "subscription": sub,
    }), 200


@api_v1.route("/billing/checkout", methods=["POST"])
@jwt_required()
@require_admin()
def create_checkout():
    """Create a Stripe Checkout session for upgrading to Pro."""
    _init_stripe()
    account = current_user.active_account

    if not account:
        return jsonify({"error": "No active account"}), 400

    data = request.get_json() or {}
    price_id = data.get("price_id")
    if not price_id:
        return jsonify({"error": "price_id is required"}), 400

    # Get or create Stripe customer
    customer_id = account.stripe_customer_id
    if not customer_id:
        try:
            customer = stripe.Customer.create(
                email=current_user.email,
                metadata={"account_id": str(account.id)},
            )
            customer_id = customer.id
            account.stripe_customer_id = customer_id
            account.save()
        except stripe.StripeError as e:
            return jsonify({"error": str(e)}), 500

    # Build checkout session
    app_base_url = current_app.config.get("APP_BASE_URL", "http://localhost:5173")
    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{app_base_url}/billing?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{app_base_url}/billing",
            metadata={"account_id": str(account.id)},
        )
    except stripe.StripeError as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"checkout_url": session.url}), 200


@api_v1.route("/billing/portal", methods=["POST"])
@jwt_required()
@require_admin()
def create_portal():
    """Create a Stripe Customer Portal session for managing subscription."""
    _init_stripe()
    account = current_user.active_account

    if not account or not account.stripe_customer_id:
        return jsonify({"error": "No billing account found"}), 400

    app_base_url = current_app.config.get("APP_BASE_URL", "http://localhost:5173")
    try:
        session = stripe.billing_portal.Session.create(
            customer=account.stripe_customer_id,
            return_url=f"{app_base_url}/billing",
        )
    except stripe.StripeError as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"portal_url": session.url}), 200


@api_v1.route("/billing/invoices", methods=["GET"])
@jwt_required()
@require_admin()
def get_invoices():
    """Fetch invoice list from Stripe for the current account."""
    _init_stripe()
    account = current_user.active_account

    if not account or not account.stripe_customer_id:
        return jsonify({"invoices": []}), 200

    try:
        invoices = stripe.Invoice.list(
            customer=account.stripe_customer_id,
            limit=20,
        )
    except stripe.StripeError as e:
        return jsonify({"error": str(e)}), 500

    result = []
    for inv in invoices.data:
        result.append({
            "id": inv.id,
            "number": inv.number,
            "status": inv.status,
            "amount_due": inv.amount_due,
            "amount_paid": inv.amount_paid,
            "currency": inv.currency,
            "created": inv.created,
            "hosted_invoice_url": inv.hosted_invoice_url,
            "invoice_pdf": inv.invoice_pdf,
            "period_start": inv.period_start,
            "period_end": inv.period_end,
        })

    return jsonify({"invoices": result}), 200


# --- Webhook endpoint (no JWT, verified by Stripe signature) ---

@api_v1.route("/billing/webhooks", methods=["POST"])
def handle_webhook():
    """Handle Stripe webhook events."""
    _init_stripe()
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get("Stripe-Signature", "")
    webhook_secret = current_app.config.get("STRIPE_WEBHOOK_SECRET", "")

    if not webhook_secret:
        return jsonify({"error": "Webhook secret not configured"}), 500

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        return jsonify({"error": "Invalid payload"}), 400
    except stripe.SignatureVerificationError:
        return jsonify({"error": "Invalid signature"}), 400

    event_type = event["type"]
    data_object = event["data"]["object"]

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data_object)
    elif event_type == "customer.subscription.created":
        _handle_subscription_created(data_object)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data_object)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data_object)
    elif event_type == "invoice.paid":
        _handle_invoice_paid(data_object)
    elif event_type == "invoice.payment_failed":
        _handle_invoice_payment_failed(data_object)

    return jsonify({"status": "ok"}), 200


def _handle_checkout_completed(session):
    """Link Stripe customer to Account after successful checkout."""
    account_id = session.get("metadata", {}).get("account_id")
    customer_id = session.get("customer")
    if account_id and customer_id:
        account = Account.objects(id=account_id).first()
        if account and not account.stripe_customer_id:
            account.stripe_customer_id = customer_id
            account.save()


def _handle_subscription_created(subscription_data):
    """Create local Subscription record from Stripe event."""
    customer_id = subscription_data.get("customer")
    account = Account.objects(stripe_customer_id=customer_id).first()
    if not account:
        return

    sub = Subscription.objects(account=account).first()
    if not sub:
        sub = Subscription(account=account)

    sub.stripe_subscription_id = subscription_data["id"]
    sub.stripe_price_id = subscription_data["items"]["data"][0]["price"]["id"] if subscription_data.get("items", {}).get("data") else None
    sub.status = subscription_data["status"]
    sub.current_period_start = datetime.datetime.utcfromtimestamp(
        subscription_data["current_period_start"]
    ) if subscription_data.get("current_period_start") else None
    sub.current_period_end = datetime.datetime.utcfromtimestamp(
        subscription_data["current_period_end"]
    ) if subscription_data.get("current_period_end") else None
    sub.cancel_at_period_end = subscription_data.get("cancel_at_period_end", False)
    sub.save()


def _handle_subscription_updated(subscription_data):
    """Sync subscription status, period, and cancellation state."""
    sub = Subscription.objects(
        stripe_subscription_id=subscription_data["id"]
    ).first()
    if not sub:
        # Try to find by customer
        customer_id = subscription_data.get("customer")
        account = Account.objects(stripe_customer_id=customer_id).first()
        if account:
            sub = Subscription.objects(account=account).first()
            if not sub:
                sub = Subscription(account=account)
            sub.stripe_subscription_id = subscription_data["id"]

    if not sub:
        return

    sub.status = subscription_data["status"]
    sub.stripe_price_id = subscription_data["items"]["data"][0]["price"]["id"] if subscription_data.get("items", {}).get("data") else sub.stripe_price_id
    sub.current_period_start = datetime.datetime.utcfromtimestamp(
        subscription_data["current_period_start"]
    ) if subscription_data.get("current_period_start") else sub.current_period_start
    sub.current_period_end = datetime.datetime.utcfromtimestamp(
        subscription_data["current_period_end"]
    ) if subscription_data.get("current_period_end") else sub.current_period_end
    sub.cancel_at_period_end = subscription_data.get("cancel_at_period_end", False)
    if subscription_data.get("canceled_at"):
        sub.canceled_at = datetime.datetime.utcfromtimestamp(
            subscription_data["canceled_at"]
        )
    sub.save()


def _handle_subscription_deleted(subscription_data):
    """Mark subscription as canceled."""
    sub = Subscription.objects(
        stripe_subscription_id=subscription_data["id"]
    ).first()
    if sub:
        sub.status = "canceled"
        sub.canceled_at = datetime.datetime.utcnow()
        sub.save()


def _handle_invoice_paid(invoice_data):
    """Confirm active status after successful payment."""
    subscription_id = invoice_data.get("subscription")
    if subscription_id:
        sub = Subscription.objects(stripe_subscription_id=subscription_id).first()
        if sub and sub.status != "active":
            sub.status = "active"
            sub.save()


def _handle_invoice_payment_failed(invoice_data):
    """Mark subscription as past_due after payment failure."""
    subscription_id = invoice_data.get("subscription")
    if subscription_id:
        sub = Subscription.objects(stripe_subscription_id=subscription_id).first()
        if sub:
            sub.status = "past_due"
            sub.save()
