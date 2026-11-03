from django.contrib.auth.models import User
from rest_framework import serializers

from accounts.models import UserProfile, normalize_mobile


class AdminUserSerializer(serializers.ModelSerializer):
    """Customer as seen by admins; create takes ``mobile`` (the login identity) and an optional tier."""

    mobile = serializers.CharField(source="username", max_length=20)
    customer_tier = serializers.ChoiceField(
        source="profile.customer_tier", choices=UserProfile.CustomerTier.choices, required=False
    )
    account_status = serializers.CharField(source="profile.account_status", read_only=True)
    created_source = serializers.CharField(source="profile.created_source", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "mobile", "first_name", "last_name", "is_active", "customer_tier", "account_status",
            "created_source", "date_joined", "last_login",
        ]
        read_only_fields = ["is_active", "date_joined", "last_login"]

    def validate_mobile(self, value: str) -> str:
        mobile = normalize_mobile(value)
        if User.objects.filter(username=mobile).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("A user with this mobile already exists.")
        return mobile

    def create(self, validated_data: dict) -> User:
        return UserProfile.create_customer(
            validated_data["username"],
            UserProfile.CreatedSource.ADMIN_CREATED,
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            customer_tier=validated_data.get("profile", {}).get("customer_tier", UserProfile.CustomerTier.RETAIL),
        )

    def update(self, user: User, validated_data: dict) -> User:
        """Names only (``admin.users.edit``); tier and status have their own endpoints and permissions."""
        for name in ("first_name", "last_name"):
            if name in validated_data:
                setattr(user, name, validated_data[name])
        user.save(update_fields=["first_name", "last_name"])
        return user


class CustomerTierSerializer(serializers.Serializer):
    customer_tier = serializers.ChoiceField(choices=UserProfile.CustomerTier.choices)
