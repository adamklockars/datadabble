"""Seed script for populating development database with realistic sample data.

Usage:
    python seed.py          # Seed development database
    python seed.py --clean  # Remove all seed data first, then seed
"""
import sys
import datetime
import random

# Bootstrap Flask app
from app import create_app

app = create_app("development")

SEED_MARKER = "seeded-by-datadabble"


def clean_seed():
    """Remove all data from the database."""
    with app.app_context():
        from app.models import (
            User, Account, AccountMembership, Database, Field, Entry,
            Visualization, AuditLog, Notification, NotificationPreference,
            Subscription, OAuthClient, OAuthAuthorizationCode, OAuthToken,
        )

        OAuthToken.objects.delete()
        OAuthAuthorizationCode.objects.delete()
        OAuthClient.objects.delete()
        NotificationPreference.objects.delete()
        Notification.objects.delete()
        AuditLog.objects.delete()
        Visualization.objects.delete()
        Entry.objects.delete()
        Field.objects.delete()
        Database.objects.delete()
        Subscription.objects.delete()
        AccountMembership.objects.delete()
        Account.objects.delete()
        User.objects.delete()

        print("All data removed.")


def run_seed():
    """Populate database with sample data."""
    with app.app_context():
        from app.models import (
            User, Account, AccountMembership, ResourcePermissions,
            Database, Field, Entry, Visualization, AuditLog,
            Notification, NotificationPreference, NotificationChannel,
            Subscription, OAuthClient,
        )

        print("Creating users...")
        # --- Users ---
        admin_user = User(email="admin@datadabble.com", first_name="Admin", last_name="User")
        admin_user.set_password("password123")
        admin_user.save()

        member_user = User(email="member@datadabble.com", first_name="Member", last_name="User")
        member_user.set_password("password123")
        member_user.save()

        viewer_user = User(email="viewer@datadabble.com", first_name="Viewer", last_name="User")
        viewer_user.set_password("password123")
        viewer_user.save()

        print("Creating accounts...")
        # --- Accounts ---
        acme = Account(name="Acme Corp Workspace", owner=admin_user)
        acme.save()

        side_project = Account(name="Side Project", owner=member_user)
        side_project.save()

        print("Creating memberships...")
        # --- Memberships ---
        # admin is admin of Acme
        m1 = AccountMembership(
            account=acme, user=admin_user, role="admin",
            permissions=ResourcePermissions.from_role("admin"), status="active",
        )
        m1.save()

        # member is member of Acme
        m2 = AccountMembership(
            account=acme, user=member_user, role="member",
            permissions=ResourcePermissions.from_role("member"), status="active",
            invited_by=admin_user, invited_at=datetime.datetime.utcnow(),
            accepted_at=datetime.datetime.utcnow(),
        )
        m2.save()

        # viewer is read-only of Acme (member with no write perms)
        from app.models import Permissions
        read_only = ResourcePermissions(
            database=Permissions(create=False, read=True, update=False, delete=False),
            field=Permissions(create=False, read=True, update=False, delete=False),
            entry=Permissions(create=False, read=True, update=False, delete=False),
            user=Permissions(create=False, read=False, update=False, delete=False),
        )
        m3 = AccountMembership(
            account=acme, user=viewer_user, role="member",
            permissions=read_only, status="active",
            invited_by=admin_user, invited_at=datetime.datetime.utcnow(),
            accepted_at=datetime.datetime.utcnow(),
        )
        m3.save()

        # member is admin of Side Project
        m4 = AccountMembership(
            account=side_project, user=member_user, role="admin",
            permissions=ResourcePermissions.from_role("admin"), status="active",
        )
        m4.save()

        # Set active accounts
        admin_user.active_account = acme
        admin_user.save()
        member_user.active_account = acme
        member_user.save()
        viewer_user.active_account = acme
        viewer_user.save()

        print("Creating subscription...")
        # --- Subscription (Pro for Acme) ---
        sub = Subscription(
            account=acme,
            stripe_subscription_id="sub_seed_pro_123",
            stripe_price_id="price_seed_pro_monthly",
            status="active",
            current_period_start=datetime.datetime.utcnow() - datetime.timedelta(days=15),
            current_period_end=datetime.datetime.utcnow() + datetime.timedelta(days=15),
        )
        sub.save()

        print("Creating databases and entries...")
        # --- Database 1: Customer Tracker ---
        db1 = Database(title="Customer Tracker", slug="customer-tracker", description="Track customer relationships and revenue", user=admin_user, account=acme)
        db1.save()

        f1_1 = Field(database=db1, name="company", field_type="STR", required=True, order=0)
        f1_2 = Field(database=db1, name="contact_email", field_type="EMAIL", required=True, order=1)
        f1_3 = Field(database=db1, name="revenue", field_type="DEC", order=2)
        f1_4 = Field(database=db1, name="status", field_type="STR", order=3)
        f1_5 = Field(database=db1, name="signed_date", field_type="DATE", order=4)
        f1_6 = Field(database=db1, name="is_active", field_type="BOOL", order=5)
        for f in [f1_1, f1_2, f1_3, f1_4, f1_5, f1_6]:
            f.save()

        companies = ["Acme Inc", "Globex Corp", "Initech", "Umbrella Corp", "Wayne Enterprises",
                      "Stark Industries", "Oscorp", "LexCorp", "Cyberdyne", "Soylent Corp",
                      "Tyrell Corp", "Weyland-Yutani", "Massive Dynamic", "Aperture Science",
                      "Black Mesa", "Abstergo Industries", "Vault-Tec", "Momcorp", "Planet Express",
                      "Buy n Large", "InGen", "Wonka Industries", "Dunder Mifflin", "Pied Piper", "Hooli"]
        statuses = ["active", "lead", "churned", "trial"]
        for i, company in enumerate(companies):
            Entry(database=db1, values={
                "company": company,
                "contact_email": f"contact@{company.lower().replace(' ', '')}.com",
                "revenue": round(random.uniform(5000, 500000), 2),
                "status": random.choice(statuses),
                "signed_date": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                "is_active": random.choice([True, True, True, False]),
            }).save()

        # --- Database 2: Product Inventory ---
        db2 = Database(title="Product Inventory", slug="product-inventory", description="Track products and stock levels", user=admin_user, account=acme)
        db2.save()

        f2_1 = Field(database=db2, name="product_name", field_type="STR", required=True, order=0)
        f2_2 = Field(database=db2, name="sku", field_type="STR", required=True, order=1)
        f2_3 = Field(database=db2, name="category", field_type="STR", order=2)
        f2_4 = Field(database=db2, name="price", field_type="DEC", order=3)
        f2_5 = Field(database=db2, name="stock_count", field_type="INT", order=4)
        f2_6 = Field(database=db2, name="in_stock", field_type="BOOL", order=5)
        for f in [f2_1, f2_2, f2_3, f2_4, f2_5, f2_6]:
            f.save()

        products = [
            ("Wireless Mouse", "Electronics"), ("Mechanical Keyboard", "Electronics"),
            ("USB-C Hub", "Electronics"), ("Monitor Stand", "Furniture"),
            ("Standing Desk", "Furniture"), ("Ergonomic Chair", "Furniture"),
            ("Webcam HD", "Electronics"), ("Noise-Cancelling Headphones", "Electronics"),
            ("Desk Lamp", "Lighting"), ("Cable Organizer", "Accessories"),
            ("Laptop Sleeve", "Accessories"), ("Mouse Pad XL", "Accessories"),
            ("Whiteboard", "Office"), ("Sticky Notes Pack", "Office"),
            ("Filing Cabinet", "Furniture"), ("Printer Paper", "Office"),
            ("Ink Cartridge", "Office"), ("Screen Cleaner", "Accessories"),
            ("USB Flash Drive", "Electronics"), ("External SSD", "Electronics"),
            ("Surge Protector", "Electronics"), ("Desk Organizer", "Accessories"),
            ("Bookend Set", "Office"), ("Pen Holder", "Office"),
            ("Wireless Charger", "Electronics"), ("Phone Stand", "Accessories"),
            ("Keyboard Wrist Rest", "Accessories"), ("Blue Light Glasses", "Accessories"),
            ("Portable Speaker", "Electronics"), ("Desk Fan", "Accessories"),
        ]
        for i, (name, category) in enumerate(products):
            stock = random.randint(0, 200)
            Entry(database=db2, values={
                "product_name": name,
                "sku": f"SKU-{1000 + i}",
                "category": category,
                "price": round(random.uniform(9.99, 499.99), 2),
                "stock_count": stock,
                "in_stock": stock > 0,
            }).save()

        # --- Database 3: Bug Tracker ---
        db3 = Database(title="Bug Tracker", slug="bug-tracker", description="Track software bugs and issues", user=admin_user, account=acme)
        db3.save()

        f3_1 = Field(database=db3, name="title", field_type="STR", required=True, order=0)
        f3_2 = Field(database=db3, name="severity", field_type="STR", order=1)
        f3_3 = Field(database=db3, name="status", field_type="STR", order=2)
        f3_4 = Field(database=db3, name="assigned_to", field_type="EMAIL", order=3)
        f3_5 = Field(database=db3, name="reported_date", field_type="DATE", order=4)
        f3_6 = Field(database=db3, name="is_resolved", field_type="BOOL", order=5)
        for f in [f3_1, f3_2, f3_3, f3_4, f3_5, f3_6]:
            f.save()

        bugs = [
            "Login page crashes on mobile", "Slow API response on /databases",
            "CSV export missing headers", "Dashboard chart not rendering",
            "Email notifications not sending", "Search filter ignores case",
            "Pagination breaks with filters", "Dark mode toggle flicker",
            "Memory leak in entry editor", "Drag-and-drop reorder fails",
            "Permission check too strict", "Date picker wrong timezone",
            "File upload size not validated", "Duplicate slug conflict",
            "JWT refresh race condition",
        ]
        severities = ["critical", "high", "medium", "low"]
        bug_statuses = ["open", "in_progress", "resolved", "closed"]
        assignees = ["admin@datadabble.com", "member@datadabble.com"]
        for i, title in enumerate(bugs):
            resolved = random.choice([True, False])
            Entry(database=db3, values={
                "title": title,
                "severity": random.choice(severities),
                "status": "resolved" if resolved else random.choice(bug_statuses[:2]),
                "assigned_to": random.choice(assignees),
                "reported_date": f"2025-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                "is_resolved": resolved,
            }).save()

        # --- Database 4: Personal Notes (Side Project, owned by member) ---
        db4 = Database(title="Personal Notes", slug="personal-notes", description="Quick notes and ideas", user=member_user, account=side_project)
        db4.save()

        f4_1 = Field(database=db4, name="title", field_type="STR", required=True, order=0)
        f4_2 = Field(database=db4, name="content", field_type="STR", order=1)
        f4_3 = Field(database=db4, name="tag", field_type="STR", order=2)
        for f in [f4_1, f4_2, f4_3]:
            f.save()

        notes = [
            ("API redesign ideas", "Consider GraphQL for complex queries. REST for simple CRUD.", "tech"),
            ("Meeting notes 2025-01-15", "Discussed Q1 roadmap. Focus on developer tools.", "meeting"),
            ("Book: Designing Data-Intensive Apps", "Great chapter on replication strategies.", "reading"),
            ("Weekend project", "Build a CLI for DataDabble seed management.", "personal"),
            ("Performance benchmarks", "Current: 150ms avg. Target: <100ms for list endpoints.", "tech"),
        ]
        for title, content, tag in notes:
            Entry(database=db4, values={"title": title, "content": content, "tag": tag}).save()

        print("Creating visualizations...")
        # --- Visualizations ---
        viz1 = Visualization(
            user=admin_user, title="Revenue by Company",
            chart_type="bar", database_slugs=["customer-tracker"],
            x_field="company", y_field="revenue", aggregation="sum",
        )
        viz1.save()

        viz2 = Visualization(
            user=admin_user, title="Products by Category",
            chart_type="pie", database_slugs=["product-inventory"],
            x_field="category", aggregation="count",
        )
        viz2.save()

        viz3 = Visualization(
            user=admin_user, title="Bug Status Overview",
            chart_type="bar", database_slugs=["bug-tracker"],
            x_field="status", aggregation="count",
        )
        viz3.save()

        print("Creating OAuth client...")
        # --- OAuth Client ---
        client = OAuthClient(
            client_id="sample-dev-app-001",
            name="Sample Developer App",
            description="A sample OAuth application for testing the developer API",
            redirect_uris=["http://localhost:3000/callback", "http://localhost:8080/auth/callback"],
            scopes=["read:user", "read:databases", "read:entries", "read:fields"],
            user=admin_user, account=acme,
        )
        client.set_secret("sample-secret-do-not-use-in-production")
        client.save()

        print("Creating audit logs...")
        # --- Audit Logs ---
        audit_actions = [
            ("DATABASE_CREATED", "database", db1.title, db1),
            ("DATABASE_CREATED", "database", db2.title, db2),
            ("DATABASE_CREATED", "database", db3.title, db3),
            ("FIELD_CREATED", "field", "company", db1),
            ("FIELD_CREATED", "field", "product_name", db2),
            ("ENTRY_CREATED", "entry", None, db1),
            ("ENTRY_CREATED", "entry", None, db2),
            ("ENTRY_UPDATED", "entry", None, db1),
            ("DATABASE_UPDATED", "database", db1.title, db1),
            ("FIELD_UPDATED", "field", "status", db3),
            ("ENTRY_DELETED", "entry", None, db3),
        ]
        for action, res_type, res_name, db_ref in audit_actions:
            AuditLog(
                account=acme, database=db_ref, database_slug=db_ref.slug,
                user=admin_user, user_email=admin_user.email,
                action=action, resource_type=res_type, resource_name=res_name,
                details=f"Seed: {action} on {res_type}",
            ).save()

        print("Creating notifications...")
        # --- Notifications ---
        notifs = [
            ("team_invite", "You've been invited to Acme Corp Workspace", "admin@datadabble.com invited you", member_user),
            ("database_created", "New database: Customer Tracker", "admin@datadabble.com created database 'Customer Tracker'", member_user),
            ("database_created", "New database: Product Inventory", "admin@datadabble.com created database 'Product Inventory'", member_user),
            ("entry_updated", "Entry updated in Bug Tracker", "admin@datadabble.com updated an entry", viewer_user),
            ("database_updated", "Database updated: Customer Tracker", "member@datadabble.com updated database 'Customer Tracker'", admin_user),
            ("field_created", "New field in Customer Tracker", "admin@datadabble.com added field 'revenue'", member_user),
        ]
        for i, (ntype, title, message, recipient) in enumerate(notifs):
            Notification(
                user=recipient, account=acme, notification_type=ntype,
                title=title, message=message, link="/dashboard",
                actor_email="admin@datadabble.com",
                read=(i < 2),  # First 2 are read
            ).save()

        print("Creating notification preferences...")
        # --- Notification Preferences ---
        NotificationPreference(
            user=admin_user, email_enabled=True,
            team_invites=NotificationChannel(in_app=True, email=True),
            database_changes=NotificationChannel(in_app=True, email=True),
            entry_modifications=NotificationChannel(in_app=True, email=False),
            field_changes=NotificationChannel(in_app=True, email=False),
            weekly_digest=True,
        ).save()

        NotificationPreference(
            user=member_user, email_enabled=True,
            team_invites=NotificationChannel(in_app=True, email=True),
            database_changes=NotificationChannel(in_app=True, email=False),
            entry_modifications=NotificationChannel(in_app=False, email=False),
            field_changes=NotificationChannel(in_app=True, email=False),
        ).save()

        print("\nSeed data created successfully!")
        print(f"  Users: 3 (admin/member/viewer@datadabble.com, password: password123)")
        print(f"  Accounts: 2 (Acme Corp - Pro, Side Project - Free)")
        print(f"  Databases: 4 (Customer Tracker, Product Inventory, Bug Tracker, Personal Notes)")
        print(f"  Visualizations: 3")
        print(f"  OAuth Client: 1 (client_id: sample-dev-app-001)")
        print(f"  Audit Logs: {len(audit_actions)}")
        print(f"  Notifications: {len(notifs)}")


if __name__ == "__main__":
    if "--clean" in sys.argv:
        clean_seed()
    run_seed()
