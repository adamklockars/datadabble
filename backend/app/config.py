"""Application configuration."""
import os
from datetime import timedelta


class Config:
    """Base configuration."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

    # MongoDB settings
    MONGODB_SETTINGS = {
        "db": os.environ.get("MONGODB_DB", "datadabble"),
        "host": os.environ.get("MONGODB_HOST", "localhost"),
        "port": int(os.environ.get("MONGODB_PORT", 27017)),
    }

    # JWT settings
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.environ.get("JWT_ACCESS_TOKEN_HOURS", 1))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.environ.get("JWT_REFRESH_TOKEN_DAYS", 30))
    )
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    # CORS settings
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

    # AI settings (Anthropic Claude)
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

    # OAuth settings
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:5173/auth/callback/google")

    GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")
    GITHUB_REDIRECT_URI = os.environ.get("GITHUB_REDIRECT_URI", "http://localhost:5173/auth/callback/github")

    # Stripe settings
    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PRO_PRODUCT_ID = os.environ.get("STRIPE_PRO_PRODUCT_ID", "")

    # Free tier limits
    FREE_TIER_MAX_DATABASES = int(os.environ.get("FREE_TIER_MAX_DATABASES", 3))
    FREE_TIER_MAX_ENTRIES_PER_DB = int(os.environ.get("FREE_TIER_MAX_ENTRIES_PER_DB", 100))
    FREE_TIER_MAX_FIELDS_PER_DB = int(os.environ.get("FREE_TIER_MAX_FIELDS_PER_DB", 10))
    FREE_TIER_MAX_MEMBERS = int(os.environ.get("FREE_TIER_MAX_MEMBERS", 2))
    FREE_TIER_AI_QUERIES_PER_DAY = int(os.environ.get("FREE_TIER_AI_QUERIES_PER_DAY", 5))
    FREE_TIER_MAX_VISUALIZATIONS = int(os.environ.get("FREE_TIER_MAX_VISUALIZATIONS", 3))

    # Email settings
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "localhost")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "noreply@datadabble.com")
    APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:5173")


class DevelopmentConfig(Config):
    """Development configuration."""

    DEBUG = True
    TESTING = False
    ENABLE_API_DOCS = True


class TestingConfig(Config):
    """Testing configuration."""

    DEBUG = False
    TESTING = True
    ENABLE_API_DOCS = True
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(hours=1)


def _init_testing_config():
    """Initialize TestingConfig MONGODB_SETTINGS with mongomock."""
    try:
        import mongomock
        TestingConfig.MONGODB_SETTINGS = {
            "db": "datadabble_test",
            "host": "localhost",
            "mongo_client_class": mongomock.MongoClient,
        }
    except ImportError:
        TestingConfig.MONGODB_SETTINGS = {
            "db": "datadabble_test",
            "host": "localhost",
        }


_init_testing_config()


class ProductionConfig(Config):
    """Production configuration."""

    DEBUG = False
    TESTING = False

    # In production, these must be set via environment variables
    @property
    def SECRET_KEY(self):
        key = os.environ.get("SECRET_KEY")
        if not key:
            raise ValueError("SECRET_KEY environment variable must be set in production")
        return key

    @property
    def JWT_SECRET_KEY(self):
        return os.environ.get("JWT_SECRET_KEY", self.SECRET_KEY)


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
