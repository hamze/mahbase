import tempfile
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from catalog.models import Brand, Category, MediaAsset, Product, ProductVariant, Tag, Unit
from catalog.tests.helpers import CatalogFixture, make_staff, png_upload


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ProductApiTests(TestCase):
    def setUp(self) -> None:
        self.data = CatalogFixture()
        self.client = APIClient()
        self.client.force_authenticate(make_staff("admin"))

    def test_create_claims_temporary_media_and_sanitizes_description(self) -> None:
        upload = self.client.post("/api/media/upload/", {"file": png_upload()}, format="multipart")
        self.assertEqual(upload.status_code, 201, upload.data)
        self.assertEqual(upload.data["image_type"], "temporary")

        payload = self.data.product_payload(media=[{"id": upload.data["id"], "image_type": "description"}])
        response = self.client.post("/api/products/", payload, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(response.data["is_published"])
        self.assertNotIn("<script>", response.data["description_long"])
        asset = MediaAsset.objects.get(pk=upload.data["id"])
        self.assertEqual((asset.image_type, asset.product_id), ("description", response.data["id"]))
        # An asset that is already active cannot be claimed again by another product.
        again = self.client.post(
            "/api/products/",
            self.data.product_payload(slug="other", variants=[{"sku": "X"}], media=[{"id": asset.pk, "image_type": "gallery"}]),
            format="json",
        )
        self.assertEqual(again.status_code, 400)
        self.assertFalse(Product.objects.filter(slug="other").exists())

    def test_rejects_duplicate_combinations_and_misused_attributes(self) -> None:
        size_s = [{"attribute": self.data.size.pk, "value": "S"}]
        cases = {
            "duplicate combination": self.data.product_payload(
                variants=[{"sku": "A", "attributes": size_s}, {"sku": "B", "attributes": size_s}]
            ),
            "variant attribute as descriptive": self.data.product_payload(attribute_values=size_s),
            "descriptive attribute on variant": self.data.product_payload(
                variants=[{"sku": "A", "attributes": [{"attribute": self.data.material.pk, "value": "Silk"}]}]
            ),
            "unknown select option": self.data.product_payload(
                variants=[{"sku": "A", "attributes": [{"attribute": self.data.size.pk, "value": "XXL"}]}]
            ),
            "no variants": self.data.product_payload(variants=[]),
        }
        for name, payload in cases.items():
            with self.subTest(name):
                self.assertEqual(self.client.post("/api/products/", payload, format="json").status_code, 400)
        self.assertEqual(Product.objects.count(), 0)

    def test_variant_update_is_atomic_with_combination_hash(self) -> None:
        product = self.data.create_product()
        small = product.variants.get(sku="SHIRT-S")
        original_hash = small.combination_hash
        url = f"/api/products/{product.pk}/variants/{small.pk}/"

        clash = self.client.put(url, {"sku": "SHIRT-S", "attributes": [{"attribute": self.data.size.pk, "value": "M"}]}, format="json")
        self.assertEqual(clash.status_code, 400)
        small.refresh_from_db()
        self.assertEqual(small.combination_hash, original_hash)
        self.assertEqual(list(small.attributes.values_list("value", flat=True)), ["S"])

        moved = self.client.put(url, {"sku": "SHIRT-L", "attributes": [{"attribute": self.data.size.pk, "value": "L"}]}, format="json")
        self.assertEqual(moved.status_code, 200, moved.data)
        small.refresh_from_db()
        self.assertEqual(small.combination_hash, ProductVariant.compute_combination_hash([(self.data.size, "L")]))
        self.assertEqual(list(small.attributes.values_list("value", flat=True)), ["L"])

    def test_adjust_prices_scales_category_with_subcategories_only(self) -> None:
        product = self.data.create_product()
        product.variants.update(base_price=Decimal("100000"), wholesale_price=None)
        product.variants.filter(sku="SHIRT-S").update(wholesale_price=Decimal("90500"))
        child = Category.objects.create(name="Shirts", slug="shirts", parent=self.data.category)
        child_product = Product.objects.create(name="Tee", slug="tee", category=child, unit=self.data.unit)
        ProductVariant(product=child_product, sku="TEE", base_price=Decimal("33400")).set_attributes([])
        other = Product.objects.create(name="Rice", slug="rice", category=self.data.other_category, unit=self.data.unit)
        ProductVariant(product=other, sku="RICE", base_price=Decimal("500")).set_attributes([])

        response = self.client.post(
            "/api/variants/adjust-prices/", {"percentage": "10", "category": self.data.category.pk}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["updated"], 3)
        prices = dict(ProductVariant.objects.values_list("sku", "base_price"))
        # 33,400 * 1.1 = 36,740 and 90,500 * 1.1 = 99,550 round to the nearest thousand Toman.
        self.assertEqual(prices, {"SHIRT-S": Decimal("110000"), "SHIRT-M": Decimal("110000"),
                                  "TEE": Decimal("37000"), "RICE": Decimal("500")})
        self.assertEqual(ProductVariant.objects.get(sku="SHIRT-S").wholesale_price, Decimal("100000"))
        self.assertIsNone(ProductVariant.objects.get(sku="SHIRT-M").wholesale_price)

        self.assertEqual(self.client.post("/api/variants/adjust-prices/", {"percentage": "-100"}, format="json").status_code, 400)

    def test_brand_and_tag_availability_follows_category_rules(self) -> None:
        child = Category.objects.create(name="Shirts", slug="shirts", parent=self.data.category)
        Brand.objects.create(name="Global", slug="global")
        Brand.objects.create(name="Kids", slug="kids").categories.add(child)
        sale = Tag.objects.create(name="Sale", slug="sale")
        Tag.objects.create(name="Small", slug="small").categories.add(child)

        def names(resource: str, category: Category) -> set[str]:
            response = self.client.get(f"/api/{resource}/", {"category": category.pk})
            return {row["name"] for row in response.data["results"]}

        # No categories = every category; a main category's brand/tag also applies to its subcategories.
        self.assertEqual(names("brands", child), {"Acme", "Global", "Kids"})
        self.assertEqual(names("brands", self.data.category), {"Acme", "Global"})
        self.assertEqual(names("brands", self.data.other_category), {"Global"})
        self.assertEqual(names("tags", child), {"New", "Sale", "Small"})
        self.assertEqual(names("tags", self.data.category), {"New", "Sale"})
        self.assertEqual(names("tags", self.data.other_category), {"Sale"})

        # Product validation applies the same rule.
        payload = self.data.product_payload(
            category=child.pk, attribute_values=[], tags=[sale.pk], variants=[{"sku": "KID-1", "attributes": []}]
        )
        self.assertEqual(self.client.post("/api/products/", payload, format="json").status_code, 201)
        payload.update(slug="other", category=self.data.other_category.pk, brand=None, tags=[self.data.tag.pk],
                       variants=[{"sku": "KID-2", "attributes": []}])
        response = self.client.post("/api/products/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("tags", response.data)

    def test_category_change_revalidates_assignments(self) -> None:
        product = self.data.create_product()
        payload = {"name": "Shirt", "slug": "shirt", "category": self.data.other_category.pk, "unit": self.data.unit.pk,
                   "brand": None, "tags": []}
        response = self.client.put(f"/api/products/{product.pk}/", payload, format="json")
        # Size (used by the variants) is not assigned to the new category.
        self.assertEqual(response.status_code, 400)
        payload["brand"] = self.data.brand.pk
        self.data.size.categories.add(self.data.other_category)
        response = self.client.put(f"/api/products/{product.pk}/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("brand", response.data)

    def test_soft_delete_restore_keep_publication_state(self) -> None:
        product = self.data.create_product()
        self.client.patch(f"/api/products/{product.pk}/toggle-publish/")
        self.assertEqual(self.client.delete(f"/api/products/{product.pk}/").status_code, 204)
        self.assertEqual(self.client.get("/api/products/").data["count"], 0)
        restored = self.client.patch(f"/api/products/{product.pk}/restore/")
        self.assertEqual((restored.data["deleted_at"], restored.data["is_published"]), (None, True))
        self.assertEqual(self.client.get("/api/products/shirt/").status_code, 200)

    def test_referenced_metadata_is_deactivated_not_deleted(self) -> None:
        self.data.create_product()
        spare = Unit.objects.create(name="Kg", symbol="kg")
        self.assertEqual(self.client.delete(f"/api/units/{spare.pk}/").status_code, 204)
        response = self.client.delete(f"/api/units/{self.data.unit.pk}/")
        self.assertEqual(response.data, {"id": self.data.unit.pk, "deactivated": True})
        self.data.unit.refresh_from_db()
        self.assertFalse(self.data.unit.is_active)
        option = self.data.size.options.get(value="S")
        self.assertTrue(self.client.delete(f"/api/attributes/{self.data.size.pk}/options/{option.pk}/").data["deactivated"])

    def test_category_icon_upload_replaces_previous_icon(self) -> None:
        def upload_icon() -> dict:
            response = self.client.post(
                "/api/media/upload/",
                {"file": png_upload(), "category": self.data.category.pk, "image_type": "category_icon"},
                format="multipart",
            )
            self.assertEqual(response.status_code, 201, response.data)
            return response.data

        first = upload_icon()
        second = upload_icon()

        category = self.client.get(f"/api/categories/{self.data.category.pk}/").data
        self.assertEqual(category["icon_url"], second["url"])
        released = MediaAsset.objects.get(pk=first["id"])
        self.assertEqual((released.image_type, released.category_id), ("temporary", None))

    def test_update_detaches_removed_media_and_ignores_other_products_assets(self) -> None:
        product = self.data.create_product()
        other = Product.objects.create(name="Other", slug="other", category=self.data.category, unit=self.data.unit)
        kept, removed, foreign = (
            MediaAsset.objects.create(file=MediaAsset.convert_upload(png_upload()), image_type="gallery", product=owner)
            for owner in (product, product, other)
        )

        response = self.client.patch(
            f"/api/products/{product.pk}/", {"remove_media": [removed.pk, foreign.pk]}, format="json"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([item["id"] for item in response.data["media"]], [kept.pk])
        removed.refresh_from_db()
        foreign.refresh_from_db()
        self.assertEqual((removed.image_type, removed.product_id), ("temporary", None))
        self.assertEqual(foreign.product_id, other.pk)


class PermissionTests(TestCase):
    def setUp(self) -> None:
        self.data = CatalogFixture()
        self.client = APIClient()

    def test_backend_denies_missing_permissions(self) -> None:
        payload = self.data.product_payload()
        self.client.force_authenticate(make_staff("editor", ("products.create",)))
        # Creating with prices requires products.edit_price.
        self.assertEqual(self.client.post("/api/products/", payload, format="json").status_code, 403)
        for variant in payload["variants"]:
            variant.pop("base_price")
        self.assertEqual(self.client.post("/api/products/", payload, format="json").status_code, 201)
        product = Product.objects.get()
        self.assertEqual(self.client.patch(f"/api/products/{product.pk}/toggle-publish/").status_code, 403)
        variant = product.variants.first()
        self.assertEqual(self.client.patch(f"/api/variants/{variant.pk}/stock/", {"delta": "1"}, format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/units/", {"name": "x", "symbol": "x"}, format="json").status_code, 403)

        self.assertEqual(self.client.patch(f"/api/variants/{variant.pk}/price/", {"base_price": "1"}, format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/variants/adjust-prices/", {"percentage": "5"}, format="json").status_code, 403)

        # A price-only role can change prices without products.edit, and only price columns are written.
        self.client.force_authenticate(make_staff("pricer", ("products.edit_price",)))
        ProductVariant.objects.filter(pk=variant.pk).update(stock_quantity=7)
        response = self.client.patch(f"/api/variants/{variant.pk}/price/", {"base_price": "250"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        variant.refresh_from_db()
        self.assertEqual((variant.base_price, variant.stock_quantity), (Decimal("250"), Decimal("7")))
        self.assertEqual(self.client.patch(f"/api/variants/{variant.pk}/stock/", {"delta": "1"}, format="json").status_code, 403)

        self.client.force_authenticate(User.objects.create_user(username="customer", password="pw"))
        self.assertEqual(self.client.get("/api/products/").status_code, 403)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class MediaConstraintTests(TestCase):
    def test_database_enforces_media_ownership(self) -> None:
        data = CatalogFixture()
        product = data.create_product()
        asset = MediaAsset.objects.create(file=MediaAsset.convert_upload(png_upload()))
        invalid = [
            {"image_type": "temporary", "product": product},
            {"image_type": "gallery"},
            {"image_type": "brand_logo", "product": product},
            {"image_type": "gallery", "product": product, "brand": data.brand},
        ]
        for fields in invalid:
            with self.subTest(fields=fields), self.assertRaises(IntegrityError), transaction.atomic():
                MediaAsset.objects.filter(pk=asset.pk).update(**fields)
