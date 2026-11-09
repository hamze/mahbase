import tempfile
import threading
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.core.exceptions import ValidationError
from django.core.files.storage import FileSystemStorage
from django.db import connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from catalog.media_cleanup import cleanup_temporary_media
from catalog.models import MediaAsset, ProductVariant
from catalog.tests.helpers import CatalogFixture, png_upload


class ConcurrentStockTests(TransactionTestCase):
    def test_parallel_decrements_never_oversell(self) -> None:
        variant = CatalogFixture().create_product().variants.get(sku="SHIRT-S")  # stock 5
        results = []

        def buy() -> None:
            try:
                ProductVariant.update_stock(variant.pk, delta=Decimal("-1"))
                results.append("ok")
            except ValidationError:
                results.append("rejected")
            finally:
                connection.close()

        threads = [threading.Thread(target=buy) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        variant.refresh_from_db()
        self.assertEqual(variant.stock_quantity, Decimal("0"))
        self.assertEqual(results.count("ok"), 5)
        self.assertEqual(results.count("rejected"), 3)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(), MEDIA_TEMPORARY_RETENTION_HOURS=24)
class MediaCleanupTests(TestCase):
    def _asset(self, hours_old: int, **owner: object) -> MediaAsset:
        image_type = owner.pop("image_type", MediaAsset.ImageType.TEMPORARY)
        since = timezone.now() - timedelta(hours=hours_old) if image_type == MediaAsset.ImageType.TEMPORARY else None
        return MediaAsset.objects.create(
            file=MediaAsset.convert_upload(png_upload()), image_type=image_type, temporary_since=since, **owner
        )

    def test_only_expired_ownerless_temporary_media_is_removed(self) -> None:
        product = CatalogFixture().create_product()
        expired = self._asset(48)
        recent = self._asset(1)
        active = self._asset(48, image_type=MediaAsset.ImageType.GALLERY, product=product)
        expired_name = expired.file.name

        self.assertEqual(cleanup_temporary_media(), 1)

        self.assertFalse(MediaAsset.objects.filter(pk=expired.pk).exists())
        self.assertFalse(expired.file.storage.exists(expired_name))
        self.assertTrue(MediaAsset.objects.filter(pk__in=[recent.pk, active.pk]).count() == 2)
        self.assertTrue(active.file.storage.exists(active.file.name))

    def test_failed_file_deletion_keeps_row_for_retry(self) -> None:
        expired = self._asset(48)
        with mock.patch.object(FileSystemStorage, "delete", side_effect=OSError("storage down")):
            self.assertEqual(cleanup_temporary_media(), 0)
        expired.refresh_from_db()
        self.assertEqual(expired.image_type, MediaAsset.ImageType.TEMPORARY)
        self.assertEqual(cleanup_temporary_media(), 1)


class MediaOwnershipConstraintTests(TestCase):
    """The database check accepts each new type only with its own owner and exactly one owner."""

    def test_new_owner_types_require_exactly_their_owner(self) -> None:
        from django.db import IntegrityError, transaction

        from blog.models import BlogCategory, BlogPost
        from catalog.tests.helpers import make_staff
        from commerce.models import Banner, StoreSettings

        upload = MediaAsset.objects.create(file=png_upload(), temporary_since=timezone.now())
        post = BlogPost.objects.create(
            title="p", slug="p", category=BlogCategory.objects.create(name="c", slug="c"), author=make_staff("a")
        )
        banner = Banner.objects.create(title="b", image=upload, position="HERO")
        store = StoreSettings.get_solo()

        valid = [("blog_cover", {"blog_post": post}), ("banner_image", {"banner": banner}),
                 ("store_logo", {"store_setting": store}), ("trust_badge", {"store_setting": store})]
        invalid = [("blog_cover", {"banner": banner}), ("banner_image", {}), ("temporary", {"blog_post": post}),
                   ("store_logo", {"store_setting": store, "banner": banner})]
        for image_type, owners in valid:
            MediaAsset.objects.filter(pk=upload.pk).update(image_type=image_type, **owners)
            MediaAsset.release(pk=upload.pk)
        for image_type, owners in invalid:
            with self.subTest(image_type=image_type, owners=list(owners)), self.assertRaises(IntegrityError):
                with transaction.atomic():
                    MediaAsset.objects.filter(pk=upload.pk).update(image_type=image_type, **owners)
