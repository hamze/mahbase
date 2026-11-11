from django.conf import settings
from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken, Token

from accounts.permissions import resolved_permissions


def add_permission_claims(token: Token, user: User) -> None:
    token["permissions"] = resolved_permissions(user)
    token["is_superuser"] = user.is_superuser
    token["is_staff"] = user.is_staff


class PermissionRefreshToken(RefreshToken):
    """JWTs carry the flat ``permissions`` list and ``is_superuser``. They are re-resolved from the database each
    time an access token is issued (login and every refresh), so a group change applies within one access TTL.

    Refresh tokens rotate on every refresh, so a session lasts while it is used: customers stay signed in until
    ``REFRESH_TOKEN_LIFETIME`` (90 days by default) passes without a visit; staff refresh tokens live
    ``STAFF_REFRESH_TOKEN_LIFETIME`` (1 day).
    """

    @classmethod
    def for_user(cls, user: User) -> "PermissionRefreshToken":
        token = super().for_user(user)
        add_permission_claims(token, user)
        token.set_exp()
        return token

    def set_exp(self, claim: str = "exp", from_time: object = None, lifetime: object = None) -> None:
        if claim == "exp" and lifetime is None and self.payload.get("is_staff"):
            lifetime = settings.STAFF_REFRESH_TOKEN_LIFETIME
        super().set_exp(claim, from_time, lifetime)

    @property
    def access_token(self) -> AccessToken:
        add_permission_claims(self, User.objects.get(pk=self[api_settings.USER_ID_CLAIM]))
        return super().access_token


class PermissionTokenObtainPairSerializer(TokenObtainPairSerializer):
    token_class = PermissionRefreshToken


class PermissionTokenRefreshSerializer(TokenRefreshSerializer):
    token_class = PermissionRefreshToken
