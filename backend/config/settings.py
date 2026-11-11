import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name, default):
    return os.environ.get(name, str(default)).lower() in ("1", "true", "yes")


def env_list(name, default):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", 'cha%$fgdg#$Tgfgkjdf5')
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    # Listed for its Persian messages (locale); token_blacklist holds the models.
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "accounts",
    "catalog",
    "commerce",
    "blog",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "mahbase"),
        "USER": os.environ.get("POSTGRES_USER", "mahbase"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "change-me"),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5434"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fa"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("DJANGO_MEDIA_ROOT", BASE_DIR / "media"))
# Let Django serve MEDIA_URL itself (independent of DEBUG). Set false only when a proxy serves /media/.
SERVE_MEDIA = env_bool("DJANGO_SERVE_MEDIA", True)

# Upload validation and temporary media retention (see README "Media lifecycle").
MEDIA_MAX_UPLOAD_BYTES = int(os.environ.get("MEDIA_MAX_UPLOAD_BYTES", 5 * 1024 * 1024))
MEDIA_MIN_DIMENSION = int(os.environ.get("MEDIA_MIN_DIMENSION", 50))
MEDIA_MAX_DIMENSION = int(os.environ.get("MEDIA_MAX_DIMENSION", 6000))
MEDIA_WEBP_QUALITY = int(os.environ.get("MEDIA_WEBP_QUALITY", 82))
MEDIA_TEMPORARY_RETENTION_HOURS = int(os.environ.get("MEDIA_TEMPORARY_RETENTION_HOURS", 24))

# Customer OTP login (see README "Customer authentication"). SMS_SENDER selects the SMS provider implementation.
OTP_LENGTH = int(os.environ.get("OTP_LENGTH", 6))
OTP_TTL_SECONDS = int(os.environ.get("OTP_TTL_SECONDS", 120))
# One code per mobile and purpose per OTP_RESEND_SECONDS; requests per IP are throttled by the ``otp_ip`` rate.
OTP_RESEND_SECONDS = int(os.environ.get("OTP_RESEND_SECONDS", 120))
OTP_MAX_ATTEMPTS = int(os.environ.get("OTP_MAX_ATTEMPTS", 5))
# SMS panel: accounts.services.sms.console.ConsoleSmsSender (development) or
# accounts.services.sms.kavenegar.KavenegarSmsSender. Template names live in accounts/services/sms/templates.py.
SMS_SENDER = os.environ.get("SMS_SENDER", "accounts.services.sms.console.ConsoleSmsSender")
SMS_TIMEOUT_SECONDS = int(os.environ.get("SMS_TIMEOUT_SECONDS", 10))
KAVENEGAR_API_KEY = os.environ.get("KAVENEGAR_API_KEY", "")
KAVENEGAR_API_URL = os.environ.get("KAVENEGAR_API_URL", "https://api.kavenegar.com/v1")

# Slugs of internal pages linked from the storefront menu; deleting such a page is refused.
SITE_MENU_INTERNAL_PAGES = env_list("SITE_MENU_INTERNAL_PAGES", "")

# Orders: stock is reserved at final confirmation for ORDER_RESERVATION_MINUTES (covers the bank session).
ORDER_RESERVATION_MINUTES = int(os.environ.get("ORDER_RESERVATION_MINUTES", 15))
# Public origin of the storefront; it also serves /api/, so the bank returns the customer to
# STOREFRONT_URL/api/payments/return/ and the backend then redirects to STOREFRONT_URL/checkout/result.
STOREFRONT_URL = os.environ.get("STOREFRONT_URL", "http://localhost:8081").rstrip("/")
PAYMENT_CALLBACK_URL = f"{STOREFRONT_URL}/api/payments/return/"
# Bank gateway (dotted class path). The mock bank (payment-mock/) is the only gateway for now.
PAYMENT_GATEWAY = os.environ.get("PAYMENT_GATEWAY", "commerce.services.payment_gateway.mock_bank.MockBankGateway")
PAYMENT_MERCHANT_ID = os.environ.get("PAYMENT_MERCHANT_ID", "mahbase-test-merchant")
PAYMENT_GATEWAY_TIMEOUT_SECONDS = int(os.environ.get("PAYMENT_GATEWAY_TIMEOUT_SECONDS", 10))
# Backend → mock bank (container network) and browser → mock bank.
PAYMENT_MOCK_API_URL = os.environ.get("PAYMENT_MOCK_API_URL", "http://localhost:8090").rstrip("/")
PAYMENT_MOCK_PUBLIC_URL = os.environ.get("PAYMENT_MOCK_PUBLIC_URL", "http://localhost:8090").rstrip("/")

# Celery: worker + beat release expired reservations (commerce.tasks.release_expired_reservations).
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6380/0")
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    "release-expired-reservations": {
        "task": "commerce.tasks.release_expired_reservations",
        "schedule": float(os.environ.get("RESERVATION_EXPIRY_INTERVAL_SECONDS", 30)),
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "catalog.permissions.RBACPermission",
    ],
    "DEFAULT_PAGINATION_CLASS": "catalog.pagination.CatalogPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "config.api.exceptions.exception_handler",
    # Every JSON body is {"state", "message", "data"} (config.api.responses.Responses).
    "DEFAULT_RENDERER_CLASSES": [
        "config.api.renderers.EnvelopeJSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    # Contact-form spam guard at the API boundary (commerce.throttles), counted in the shared cache.
    "DEFAULT_THROTTLE_RATES": {
        "contact_ip": os.environ.get("CONTACT_RATE_IP", "1/min"),
        "contact_mobile_minute": os.environ.get("CONTACT_RATE_MOBILE_MINUTE", "1/min"),
        "contact_mobile_hour": os.environ.get("CONTACT_RATE_MOBILE_HOUR", "5/hour"),
        "otp_ip": os.environ.get("OTP_RATE_IP", "30/hour"),
    },
}

# Shared cache (rate-limit counters must be shared by every backend process).
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.environ.get("CACHE_URL", "redis://localhost:6380/1"),
    }
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.environ.get("JWT_ACCESS_MINUTES", 5))),
    # Customers: sliding session (rotation) that ends after this many days without a visit.
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", 90))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    # Tokens carry the resolved RBAC codes and is_superuser, re-resolved on every refresh (accounts.tokens).
    "TOKEN_OBTAIN_SERIALIZER": "accounts.tokens.PermissionTokenObtainPairSerializer",
    "TOKEN_REFRESH_SERIALIZER": "accounts.tokens.PermissionTokenRefreshSerializer",
}

# Staff refresh tokens (accounts.tokens.PermissionRefreshToken); matches the admin panel's refresh cookie.
STAFF_REFRESH_TOKEN_LIFETIME = timedelta(days=int(os.environ.get("JWT_STAFF_REFRESH_DAYS", 1)))

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "default"},
    },
    "root": {"handlers": ["console"], "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO")},
}
