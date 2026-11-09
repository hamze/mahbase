from django.db import transaction
from rest_framework import serializers

from catalog.models import MediaAsset
from commerce.models import StoreSettings


class StrictSerializer(serializers.Serializer):
    """JSON-field schema: unknown keys are rejected instead of silently dropped, so stored JSON cannot drift."""

    def to_internal_value(self, data: object) -> dict:
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError({key: "Unknown field." for key in sorted(unknown)})
        return super().to_internal_value(data)


class SocialLinksSerializer(StrictSerializer):
    instagram = serializers.URLField(allow_null=True, required=False)
    telegram = serializers.URLField(allow_null=True, required=False)
    whatsapp = serializers.URLField(allow_null=True, required=False)
    twitter = serializers.URLField(allow_null=True, required=False)
    linkedin = serializers.URLField(allow_null=True, required=False)
    youtube = serializers.URLField(allow_null=True, required=False)
    aparat = serializers.URLField(allow_null=True, required=False)


class TrustBadgeSerializer(StrictSerializer):
    image_id = serializers.IntegerField()
    link_url = serializers.URLField(allow_blank=True, required=False, default="")


def badges_with_urls(badges: list[dict]) -> list[dict]:
    urls = {asset.pk: asset.file.url for asset in MediaAsset.objects.filter(pk__in=[b["image_id"] for b in badges])}
    return [{**badge, "image_url": urls.get(badge["image_id"])} for badge in badges]


class PublicStoreSettingsSerializer(serializers.ModelSerializer):
    """Storefront projection: no profit percentage or SMS switch."""

    logo_url = serializers.SerializerMethodField()
    trust_badges = serializers.SerializerMethodField()

    class Meta:
        model = StoreSettings
        fields = [
            "store_name", "logo_url", "primary_color", "contact_phone", "contact_email", "address", "social_links",
            "trust_badges", "reviews_enabled", "cod_enabled", "out_of_stock_display", "footer_text",
        ]
        read_only_fields = fields

    def get_logo_url(self, settings: StoreSettings) -> str | None:
        return settings.logo.file.url if settings.logo else None

    def get_trust_badges(self, settings: StoreSettings) -> list[dict]:
        return badges_with_urls(settings.trust_badges)


class StoreSettingsSerializer(serializers.ModelSerializer):
    """Admin read and full PUT. ``logo`` and each trust-badge ``image_id`` are new temporary uploads (claimed as
    STORE_LOGO / TRUST_BADGE) or assets these settings already own; replaced or dropped ones are released.
    """

    logo = serializers.PrimaryKeyRelatedField(queryset=MediaAsset.objects.all(), allow_null=True, required=False)
    logo_url = serializers.SerializerMethodField()
    social_links = SocialLinksSerializer()
    trust_badges = TrustBadgeSerializer(many=True)

    class Meta:
        model = StoreSettings
        fields = [
            "store_name", "logo", "logo_url", "primary_color", "contact_phone", "contact_email", "address",
            "social_links", "trust_badges", "default_profit_percentage", "reviews_enabled", "cod_enabled",
            "out_of_stock_display", "sms_notifications_enabled", "footer_text", "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def get_logo_url(self, settings: StoreSettings) -> str | None:
        return settings.logo.file.url if settings.logo else None

    def _is_new_or_owned(self, asset: MediaAsset, owned_type: str) -> bool:
        return asset.image_type == MediaAsset.ImageType.TEMPORARY or (
            asset.image_type == owned_type and asset.store_setting_id == self.instance.pk
        )

    def validate_logo(self, logo: MediaAsset | None) -> MediaAsset | None:
        if logo is not None and not self._is_new_or_owned(logo, MediaAsset.ImageType.STORE_LOGO):
            raise serializers.ValidationError("The logo must be a new upload or the current logo.")
        return logo

    def validate_trust_badges(self, badges: list[dict]) -> list[dict]:
        ids = [badge["image_id"] for badge in badges]
        if len(set(ids)) != len(ids):
            raise serializers.ValidationError("Each trust badge image can be used once.")
        assets = MediaAsset.objects.in_bulk(ids)
        invalid = [
            pk for pk in ids
            if pk not in assets or not self._is_new_or_owned(assets[pk], MediaAsset.ImageType.TRUST_BADGE)
        ]
        if invalid:
            raise serializers.ValidationError(f"Images {invalid} must be new uploads or current trust badges.")
        return [dict(badge) for badge in badges]

    def update(self, settings: StoreSettings, validated_data: dict) -> StoreSettings:
        with transaction.atomic():
            settings = StoreSettings.objects.select_for_update().get(pk=settings.pk)
            previous_logo_id = settings.logo_id
            owned_badges = {badge["image_id"] for badge in settings.trust_badges}
            for name, value in validated_data.items():
                setattr(settings, name, dict(value) if name == "social_links" else value)
            logo = validated_data.get("logo", settings.logo)
            if logo is not None and logo.image_type == MediaAsset.ImageType.TEMPORARY:
                MediaAsset.claim([(logo.pk, MediaAsset.ImageType.STORE_LOGO)], store_setting=settings)
            badge_ids = [badge["image_id"] for badge in settings.trust_badges]
            MediaAsset.claim(
                [(pk, MediaAsset.ImageType.TRUST_BADGE) for pk in badge_ids if pk not in owned_badges],
                store_setting=settings,
            )
            settings.save()
            if previous_logo_id is not None and previous_logo_id != settings.logo_id:
                MediaAsset.release(pk=previous_logo_id)
            MediaAsset.release(pk__in=owned_badges - set(badge_ids))
        return settings

    def to_representation(self, settings: StoreSettings) -> dict:
        data = super().to_representation(settings)
        data["trust_badges"] = badges_with_urls(settings.trust_badges)
        return data
