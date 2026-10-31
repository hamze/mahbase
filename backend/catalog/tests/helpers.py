import io

from django.contrib.auth.models import Permission, User
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from catalog.models import Attribute, AttributeOption, Brand, Category, Product, ProductVariant, Tag, Unit
from catalog.permissions import RBAC_PERMISSIONS


def make_staff(username: str, permissions: tuple[str, ...] = RBAC_PERMISSIONS) -> User:
    user = User.objects.create_user(username=username, password="pw", is_staff=True)
    codenames = [name.replace(".", "_") for name in permissions]
    user.user_permissions.set(Permission.objects.filter(content_type__app_label="catalog", codename__in=codenames))
    return user


def png_upload(name: str = "image.png", size: tuple[int, int] = (120, 80)) -> SimpleUploadedFile:
    buffer = io.BytesIO()
    Image.new("RGB", size, "red").save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class CatalogFixture:
    """A category with one brand, tag, descriptive attribute and variant-generating Select attribute."""

    def __init__(self) -> None:
        self.category = Category.objects.create(name="Clothing", slug="clothing")
        self.other_category = Category.objects.create(name="Food", slug="food")
        self.unit = Unit.objects.create(name="Piece", symbol="pc")
        self.brand = Brand.objects.create(name="Acme", slug="acme")
        self.brand.categories.add(self.category)
        self.tag = Tag.objects.create(name="New", slug="new")
        self.tag.categories.add(self.category)
        self.material = Attribute.objects.create(name="Material", type=Attribute.Type.TEXT)
        self.material.categories.add(self.category)
        self.size = Attribute.objects.create(name="Size", type=Attribute.Type.SELECT, is_variant_generator=True)
        self.size.categories.add(self.category)
        for value in ("S", "M", "L"):
            AttributeOption.objects.create(attribute=self.size, value=value)

    def product_payload(self, **overrides: object) -> dict:
        payload = {
            "name": "Shirt",
            "slug": "shirt",
            "category": self.category.pk,
            "brand": self.brand.pk,
            "unit": self.unit.pk,
            "description_short": "",
            "description_long": "<p>ok</p><script>alert(1)</script>",
            "tags": [self.tag.pk],
            "attribute_values": [{"attribute": self.material.pk, "value": "Cotton"}],
            "variants": [
                {"sku": "SHIRT-S", "attributes": [{"attribute": self.size.pk, "value": "S"}], "base_price": "100"},
                {"sku": "SHIRT-M", "attributes": [{"attribute": self.size.pk, "value": "M"}], "base_price": "100"},
            ],
        }
        payload.update(overrides)
        return payload

    def create_product(self) -> Product:
        product = Product.objects.create(name="Shirt", slug="shirt", category=self.category, unit=self.unit)
        for value, sku in (("S", "SHIRT-S"), ("M", "SHIRT-M")):
            ProductVariant(product=product, sku=sku, stock_quantity=5).set_attributes([(self.size, value)])
        return product
