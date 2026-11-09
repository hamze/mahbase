from django.core.validators import URLValidator
from django.db import transaction
from rest_framework import serializers

from catalog.models import MediaAsset
from catalog.serializers.base import ModelCleanSerializer
from commerce.models import Banner


class PublicBannerSerializer(serializers.ModelSerializer):
    image_url = serializers.CharField(source="image.file.url", read_only=True)

    class Meta:
        model = Banner
        fields = ["id", "title", "image_url", "link_url", "position", "sort_order"]
        read_only_fields = fields


class BannerSerializer(ModelCleanSerializer):
    """Admin CRUD. ``image`` is a new temporary upload (claimed as BANNER_IMAGE) or the banner's current image."""

    image = serializers.PrimaryKeyRelatedField(queryset=MediaAsset.objects.all())
    image_url = serializers.CharField(source="image.file.url", read_only=True)

    class Meta:
        model = Banner
        fields = [
            "id", "title", "image", "image_url", "link_url", "position", "start_at", "end_at", "is_active",
            "sort_order",
        ]

    def validate_link_url(self, value: str | None) -> str | None:
        """An absolute http(s) URL or a site-relative path."""
        if value and not value.startswith("/"):
            URLValidator(schemes=["http", "https"])(value)
        return value or None

    def validate_image(self, image: MediaAsset) -> MediaAsset:
        if image.image_type == MediaAsset.ImageType.TEMPORARY:
            return image
        if self.instance is not None and image.banner_id == self.instance.pk:
            return image
        raise serializers.ValidationError("The image must be a new upload or this banner's current image.")

    def create(self, validated_data: dict) -> Banner:
        with transaction.atomic():
            image = validated_data["image"]
            banner = super().create(validated_data)
            MediaAsset.claim([(image.pk, MediaAsset.ImageType.BANNER_IMAGE)], banner=banner)
        return banner

    def update(self, banner: Banner, validated_data: dict) -> Banner:
        previous_id = banner.image_id
        with transaction.atomic():
            banner = super().update(banner, validated_data)
            if banner.image_id != previous_id:
                MediaAsset.claim([(banner.image_id, MediaAsset.ImageType.BANNER_IMAGE)], banner=banner)
                MediaAsset.release(pk=previous_id)
        return banner
