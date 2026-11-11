from django.db import transaction
from rest_framework import serializers

from catalog.models import Brand, MediaAsset
from catalog.serializers.base import ModelCleanSerializer


class BrandSerializer(ModelCleanSerializer):
    logo = serializers.PrimaryKeyRelatedField(queryset=MediaAsset.objects.all(), allow_null=True, required=False)
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = ["id", "name", "slug", "logo", "logo_url", "is_active", "categories"]

    def get_logo_url(self, brand: Brand) -> str | None:
        return brand.logo.file.url if brand.logo else None

    def validate_logo(self, logo: MediaAsset | None) -> MediaAsset | None:
        if logo is None or logo.image_type == MediaAsset.ImageType.TEMPORARY:
            return logo
        if self.instance is not None and logo.brand_id == self.instance.pk:
            return logo
        raise serializers.ValidationError("لوگو باید آپلود جدید یا لوگوی فعلی همین برند باشد.")

    def create(self, validated_data: dict) -> Brand:
        logo = validated_data.pop("logo", None)
        with transaction.atomic():
            brand = super().create(validated_data)
            self._set_logo(brand, logo)
        return brand

    def update(self, brand: Brand, validated_data: dict) -> Brand:
        has_logo = "logo" in validated_data
        logo = validated_data.pop("logo", None)
        with transaction.atomic():
            brand = super().update(brand, validated_data)
            if has_logo:
                self._set_logo(brand, logo)
        return brand

    def _set_logo(self, brand: Brand, logo: MediaAsset | None) -> None:
        previous_id = brand.logo_id
        if logo is not None and logo.image_type == MediaAsset.ImageType.TEMPORARY:
            MediaAsset.claim([(logo.pk, MediaAsset.ImageType.BRAND_LOGO)], brand=brand)
        brand.logo = logo
        brand.save(update_fields=["logo"])
        if previous_id is not None and previous_id != brand.logo_id:
            MediaAsset.release(pk=previous_id)
