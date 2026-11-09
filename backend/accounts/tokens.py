from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken, Token

from accounts.permissions import resolved_permissions


def add_permission_claims(token: Token, user: User) -> None:
    token["permissions"] = resolved_permissions(user)
    token["is_superuser"] = user.is_superuser


class PermissionRefreshToken(RefreshToken):
    """JWTs carry the flat ``permissions`` list and ``is_superuser``. They are re-resolved from the database each
    time an access token is issued (login and every refresh), so a group change applies within one access TTL.
    """

    @classmethod
    def for_user(cls, user: User) -> "PermissionRefreshToken":
        token = super().for_user(user)
        add_permission_claims(token, user)
        return token

    @property
    def access_token(self) -> AccessToken:
        add_permission_claims(self, User.objects.get(pk=self[api_settings.USER_ID_CLAIM]))
        return super().access_token


class PermissionTokenObtainPairSerializer(TokenObtainPairSerializer):
    token_class = PermissionRefreshToken


class PermissionTokenRefreshSerializer(TokenRefreshSerializer):
    token_class = PermissionRefreshToken
