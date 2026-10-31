from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from catalog.models import Brand, Category, MediaAsset, Product


class MediaAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = ["id", "url", "alt_text", "image_type", "sort_order", "width", "height",
                  "product", "brand", "category"]
        read_only_fields = fields

    def get_url(self, asset: MediaAsset) -> str:
        return asset.file.url


class MediaUploadSerializer(serializers.ModelSerializer):
    """Upload without an owner creates a TEMPORARY asset; with an owner, image_type must match it."""

    file = serializers.FileField(write_only=True)
    image_type = serializers.ChoiceField(choices=MediaAsset.ImageType.choices, required=False)
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), required=False, allow_null=True)
    brand = serializers.PrimaryKeyRelatedField(queryset=Brand.objects.all(), required=False, allow_null=True)
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False, allow_null=True)

    class Meta:
        model = MediaAsset
        fields = ["file", "alt_text", "image_type", "product", "brand", "category"]

    def validate(self, attrs: dict) -> dict:
        owners = [attrs.get(name) for name in ("product", "brand", "category")]
        if not any(owners):
            attrs["image_type"] = MediaAsset.ImageType.TEMPORARY
        error = MediaAsset.owner_type_error(attrs.get("image_type", ""), *[o.pk if o else None for o in owners])
        if error:
            raise serializers.ValidationError({"image_type": error})
        attrs["file"] = MediaAsset.convert_upload(attrs["file"])
        return attrs

    def create(self, validated_data: dict) -> MediaAsset:
        if validated_data["image_type"] == MediaAsset.ImageType.TEMPORARY:
            validated_data["temporary_since"] = timezone.now()
        if validated_data["image_type"] == MediaAsset.ImageType.CATEGORY_ICON:
            # A category has one icon: the new upload replaces any previous one.
            with transaction.atomic():
                MediaAsset.release(category=validated_data["category"], image_type=MediaAsset.ImageType.CATEGORY_ICON)
                return super().create(validated_data)
        return super().create(validated_data)

    def to_representation(self, asset: MediaAsset) -> dict:
        return MediaAssetSerializer(asset, context=self.context).data
