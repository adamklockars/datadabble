"""Account membership and permissions model."""
import datetime
from mongoengine import CASCADE
from app.extensions import db


ROLES = (
    ("admin", "Administrator"),
    ("member", "Member"),
)

# Default permissions for each role
DEFAULT_PERMISSIONS = {
    "admin": {
        "database": {"create": True, "read": True, "update": True, "delete": True},
        "field": {"create": True, "read": True, "update": True, "delete": True},
        "entry": {"create": True, "read": True, "update": True, "delete": True},
        "user": {"create": True, "read": True, "update": True, "delete": True},
    },
    "member": {
        "database": {"create": False, "read": True, "update": False, "delete": False},
        "field": {"create": False, "read": True, "update": False, "delete": False},
        "entry": {"create": True, "read": True, "update": True, "delete": False},
        "user": {"create": False, "read": False, "update": False, "delete": False},
    },
}


class Permissions(db.EmbeddedDocument):
    """Embedded document for CRUD permissions on a resource type."""
    create = db.BooleanField(default=False)
    read = db.BooleanField(default=True)
    update = db.BooleanField(default=False)
    delete = db.BooleanField(default=False)

    def to_dict(self) -> dict:
        return {
            "create": self.create,
            "read": self.read,
            "update": self.update,
            "delete": self.delete,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Permissions":
        return cls(
            create=data.get("create", False),
            read=data.get("read", True),
            update=data.get("update", False),
            delete=data.get("delete", False),
        )


class ResourcePermissions(db.EmbeddedDocument):
    """Embedded document for all resource type permissions."""
    database = db.EmbeddedDocumentField(document_type=Permissions, default=lambda: Permissions())
    field = db.EmbeddedDocumentField(document_type=Permissions, default=lambda: Permissions())
    entry = db.EmbeddedDocumentField(document_type=Permissions, default=lambda: Permissions())
    user = db.EmbeddedDocumentField(document_type=Permissions, default=lambda: Permissions())

    def to_dict(self) -> dict:
        return {
            "database": self.database.to_dict() if self.database else {},
            "field": self.field.to_dict() if self.field else {},
            "entry": self.entry.to_dict() if self.entry else {},
            "user": self.user.to_dict() if self.user else {},
        }

    @classmethod
    def from_role(cls, role: str) -> "ResourcePermissions":
        """Create permissions based on role defaults."""
        defaults = DEFAULT_PERMISSIONS.get(role, DEFAULT_PERMISSIONS["member"])
        return cls(
            database=Permissions.from_dict(defaults.get("database", {})),
            field=Permissions.from_dict(defaults.get("field", {})),
            entry=Permissions.from_dict(defaults.get("entry", {})),
            user=Permissions.from_dict(defaults.get("user", {})),
        )

    @classmethod
    def from_dict(cls, data: dict) -> "ResourcePermissions":
        return cls(
            database=Permissions.from_dict(data.get("database", {})),
            field=Permissions.from_dict(data.get("field", {})),
            entry=Permissions.from_dict(data.get("entry", {})),
            user=Permissions.from_dict(data.get("user", {})),
        )


class AccountMembership(db.Document):
    """Links users to accounts with roles and permissions."""

    created_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    updated_at = db.DateTimeField(default=datetime.datetime.utcnow, required=True)
    account = db.ReferenceField(
        document_type="Account",
        reverse_delete_rule=CASCADE,
        required=True
    )
    user = db.ReferenceField(
        document_type="User",
        reverse_delete_rule=CASCADE,
        required=True
    )
    role = db.StringField(max_length=20, choices=ROLES, default="member")
    permissions = db.EmbeddedDocumentField(document_type=ResourcePermissions, default=lambda: ResourcePermissions())
    invited_by = db.ReferenceField(document_type="User")
    invited_at = db.DateTimeField()
    accepted_at = db.DateTimeField()
    status = db.StringField(
        max_length=20,
        choices=[("pending", "Pending"), ("active", "Active"), ("inactive", "Inactive")],
        default="active"
    )

    meta = {
        "collection": "account_memberships",
        "indexes": [
            "account",
            "user",
            {"fields": ["account", "user"], "unique": True},
        ],
        "ordering": ["-created_at"],
    }

    def save(self, *args, **kwargs):
        """Update updated_at timestamp on save."""
        self.updated_at = datetime.datetime.utcnow()
        # Set default permissions based on role if not set
        if not self.permissions:
            self.permissions = ResourcePermissions.from_role(self.role)
        return super().save(*args, **kwargs)

    def has_permission(self, resource_type: str, action: str) -> bool:
        """Check if membership has a specific permission."""
        if self.role == "admin":
            return True  # Admins always have all permissions

        if not self.permissions:
            return False

        resource_perms = getattr(self.permissions, resource_type, None)
        if not resource_perms:
            return False

        return getattr(resource_perms, action, False)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        def format_datetime(dt):
            if dt is None:
                return None
            if isinstance(dt, str):
                return dt
            return dt.isoformat()

        return {
            "id": str(self.id),
            "account_id": str(self.account.id) if self.account else None,
            "user_id": str(self.user.id) if self.user else None,
            "user_email": self.user.email if self.user else None,
            "user_first_name": self.user.first_name if self.user else None,
            "user_last_name": self.user.last_name if self.user else None,
            "role": self.role,
            "permissions": self.permissions.to_dict() if self.permissions else {},
            "status": self.status,
            "invited_by_id": str(self.invited_by.id) if self.invited_by else None,
            "invited_at": format_datetime(self.invited_at),
            "accepted_at": format_datetime(self.accepted_at),
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
        }

    def __repr__(self) -> str:
        return f"<AccountMembership {self.user.email if self.user else 'Unknown'} - {self.role}>"
