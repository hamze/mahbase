import io
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from django.db import models
from django.db.models import Q
from django.utils import timezone
from PIL import Image, UnidentifiedImageError

ALLOWED_IMAGE_FORMATS ={"JPEG", "PNG", "WEBP", "GIF"}

# Owner foreign key → upload folder. Every non-temporary asset has exactly one of these set.
OWNER_FOLDERS = {
    "product": "products",
    "brand": "brands",
    "category": "categories",
    "blog_post": "blog",
    "banner": "banners",
    "store_setting": "store",
}
OWNER_FIELDS = tuple(OWNER_FOLDERS)


def media_upload_to(instance: "MediaAsset", filename: str) -> str:
    owner = next((name for name in OWNER_FIELDS if getattr(instance, f"{name}_id")), None)
    folder = f"{OWNER_FOLDERS[owner]}/{getattr(instance, f'{owner}_id')}" if owner else "temporary"
    return f"{folder}/{filename}"


class MediaAsset(models.Model):
    class ImageType(models.TextChoices):
        THUMBNAIL = "thumbnail", "Thumbnail"
        MAIN = "main", "Main"
        GALLERY = "gallery", "Gallery"
        DESCRIPTION = "description", "Description"
        BRAND_LOGO = "brand_logo", "Brand logo"
        CATEGORY_ICON = "category_icon", "Category icon"
        BLOG_COVER = "blog_cover", "Blog cover"
        BLOG_CONTENT = "blog_content", "Blog content"
        BANNER_IMAGE = "banner_image", "Banner image"
        STORE_LOGO = "store_logo", "Store logo"
        TRUST_BADGE = "trust_badge", "Trust badge"
        TEMPORARY = "temporary", "Temporary"

    PRODUCT_TYPES = (ImageType.THUMBNAIL, ImageType.MAIN, ImageType.GALLERY, ImageType.DESCRIPTION)
    # The one owner foreign key each non-temporary type requires.
    OWNER_OF_TYPE = {
        **{image_type: "product" for image_type in PRODUCT_TYPES},
        ImageType.BRAND_LOGO: "brand",
        ImageType.CATEGORY_ICON: "category",
        ImageType.BLOG_COVER: "blog_post",
        ImageType.BLOG_CONTENT: "blog_post",
        ImageType.BANNER_IMAGE: "banner",
        ImageType.STORE_LOGO: "store_setting",
        ImageType.TRUST_BADGE: "store_setting",
    }

    file = models.ImageField(upload_to=media_upload_to, width_field="width", height_field="height")
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    alt_text = models.CharField(max_length=255, blank=True)
    image_type = models.CharField(max_length=20, choices=ImageType.choices, default=ImageType.TEMPORARY)
    sort_order = models.IntegerField(default=0)
    product = models.ForeignKey(
        "catalog.Product", null=True, blank=True, on_delete=models.PROTECT, related_name="media"
    )
    brand = models.ForeignKey(
        "catalog.Brand", null=True, blank=True, on_delete=models.PROTECT, related_name="media"
    )
    category = models.ForeignKey(
        "catalog.Category", null=True, blank=True, on_delete=models.PROTECT, related_name="media"
    )
    blog_post = models.ForeignKey(
        "blog.BlogPost", null=True, blank=True, on_delete=models.PROTECT, related_name="media"
    )
    banner = models.ForeignKey(
        "commerce.Banner", null=True, blank=True, on_delete=models.PROTECT, related_name="media"
    )
    store_setting = models.ForeignKey(
        "commerce.StoreSettings", null=True, blank=True, on_delete=models.PROTECT, related_name="media"
    )
    temporary_since = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        permissions = [("media_manage", "Can manage media")]
        constraints = [
            # Temporary media has no owner; every other type has exactly its one compatible owner.
            models.CheckConstraint(
                name="media_asset_type_matches_owner",
                condition=(
                    Q(image_type="temporary", **{f"{name}__isnull": True for name in OWNER_FIELDS})
                    | Q(
                        image_type__in=["thumbnail", "main", "gallery", "description"],
                        **{f"{name}__isnull": name != "product" for name in OWNER_FIELDS},
                    )
                    | Q(image_type="brand_logo", **{f"{name}__isnull": name != "brand" for name in OWNER_FIELDS})
                    | Q(image_type="category_icon", **{f"{name}__isnull": name != "category" for name in OWNER_FIELDS})
                    | Q(
                        image_type__in=["blog_cover", "blog_content"],
                        **{f"{name}__isnull": name != "blog_post" for name in OWNER_FIELDS},
                    )
                    | Q(image_type="banner_image", **{f"{name}__isnull": name != "banner" for name in OWNER_FIELDS})
                    | Q(
                        image_type__in=["store_logo", "trust_badge"],
                        **{f"{name}__isnull": name != "store_setting" for name in OWNER_FIELDS},
                    )
                ),
            ),
        ]
        indexes = [models.Index(fields=["image_type", "temporary_since"])]

    def __str__(self) -> str:
        return self.file.name

    @classmethod
    def owner_type_error(cls, image_type: str, owners: dict[str, int | None]) -> str | None:
        """``owners`` maps owner field names to ids (missing names count as unset)."""
        set_owners = [name for name in OWNER_FIELDS if owners.get(name) is not None]
        if image_type == cls.ImageType.TEMPORARY:
            return "رسانه موقت نمی‌تواند مالک داشته باشد." if set_owners else None
        if len(set_owners) != 1:
            return "رسانه فعال باید دقیقا یک مالک داشته باشد."
        required = cls.OWNER_OF_TYPE.get(image_type)
        if set_owners[0] != required:
            return f"تصویر از نوع «{image_type}» فقط می‌تواند متعلق به {required} باشد."
        return None

    def clean(self) -> None:
        error = self.owner_type_error(self.image_type, {name: getattr(self, f"{name}_id") for name in OWNER_FIELDS})
        if error:
            raise ValidationError({"image_type": error})

    @staticmethod
    def convert_upload(upload: UploadedFile) -> ContentFile:
        """Verify the real image format and dimensions and re-encode the upload as WebP."""
        if upload.size > settings.MEDIA_MAX_UPLOAD_BYTES:
            raise ValidationError({"file": f"حجم فایل بیش از {settings.MEDIA_MAX_UPLOAD_BYTES} بایت است."})
        try:
            image = Image.open(upload)
            image.verify()
            upload.seek(0)
            image = Image.open(upload)
            image.load()
        except (UnidentifiedImageError, OSError, SyntaxError):
            raise ValidationError({"file": "فایل یک تصویر معتبر نیست."})
        if image.format not in ALLOWED_IMAGE_FORMATS:
            raise ValidationError({"file": f"فرمت تصویر «{image.format}» مجاز نیست."})
        width, height = image.size
        if min(width, height) < settings.MEDIA_MIN_DIMENSION or max(width, height) > settings.MEDIA_MAX_DIMENSION:
            raise ValidationError({
                "file": f"Image dimensions must be between {settings.MEDIA_MIN_DIMENSION} "
                        f"and {settings.MEDIA_MAX_DIMENSION} pixels."
            })
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="WEBP", quality=settings.MEDIA_WEBP_QUALITY, method=6)
        return ContentFile(buffer.getvalue(), name=f"{uuid.uuid4().hex}.webp")

    @classmethod
    def claim(cls, items: list[tuple[int, str]], **owner: models.Model) -> None:
        """Attach temporary assets to one owner (e.g. ``product=product``); must run inside the caller's transaction.

        Rows are locked so a concurrent cleanup or claim cannot take the same asset.
        """
        if not items:
            return
        ids = [asset_id for asset_id, _ in items]
        assets = {
            asset.pk: asset
            for asset in cls.objects.select_for_update().filter(pk__in=ids, image_type=cls.ImageType.TEMPORARY)
        }
        missing = sorted(set(ids) - set(assets))
        if missing:
            raise ValidationError({"media": f"رسانه‌های {missing} آپلود موقت در دسترس نیستند."})
        for position, (asset_id, image_type) in enumerate(items):
            asset = assets[asset_id]
            asset.image_type = image_type
            asset.sort_order = position
            for name in OWNER_FIELDS:
                setattr(asset, name, owner.get(name))
            asset.temporary_since = None
            asset.full_clean(exclude=["file"])
            asset.save(update_fields=["image_type", "sort_order", *OWNER_FIELDS, "temporary_since"])

    @classmethod
    def release(cls, **filters: object) -> None:
        """Turn owned media back into temporary uploads so retention cleanup removes the files."""
        cls.objects.filter(**filters).update(
            image_type=cls.ImageType.TEMPORARY,
            temporary_since=timezone.now(),
            **{name: None for name in OWNER_FIELDS},
        )
