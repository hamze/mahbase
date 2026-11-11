from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from accounts.permissions import has_permission
from blog.models import BlogPost
from catalog.models import Brand, Category, MediaAsset, Product
from catalog.models.media_asset import OWNER_FIELDS
from commerce.models import Banner, StoreSettings

# Uploading straight to an owner is a write on that owner, so it needs the owner's own write codes.
OWNER_WRITE_PERMISSIONS = {
    "product": ("media.manage", "products.create", "products.edit"),
    "brand": ("brands.manage",),
    "category": ("categories.manage",),
    "blog_post": ("blog.create", "blog.edit"),
    "banner": ("banners.manage",),
    "store_setting": ("settings.edit",),
}


class MediaAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = ["id", "url", "alt_text", "image_type", "sort_order", "width", "height",
                  "product", "brand", "category", "blog_post", "banner", "store_setting"]
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
    blog_post = serializers.PrimaryKeyRelatedField(queryset=BlogPost.objects.all(), required=False, allow_null=True)
    banner = serializers.PrimaryKeyRelatedField(queryset=Banner.objects.all(), required=False, allow_null=True)
    store_setting = serializers.PrimaryKeyRelatedField(
        queryset=StoreSettings.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = MediaAsset
        fields = ["file", "alt_text", "image_type", *OWNER_FIELDS]

    def validate(self, attrs: dict) -> dict:
        owners = {name: attrs[name].pk for name in OWNER_FIELDS if attrs.get(name)}
        if not owners:
            attrs["image_type"] = MediaAsset.ImageType.TEMPORARY
        error = MediaAsset.owner_type_error(attrs.get("image_type", ""), owners)
        if error:
            raise serializers.ValidationError({"image_type": error})
        user = self.context["request"].user
        for name in owners:
            if not any(has_permission(user, code) for code in OWNER_WRITE_PERMISSIONS[name]):
                raise PermissionDenied(f"اجازه افزودن رسانه به این {name} را ندارید.")
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
