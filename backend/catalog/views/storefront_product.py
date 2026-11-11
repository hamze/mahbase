from decimal import Decimal, InvalidOperation

from django.db.models import F, Prefetch, Q, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.models import UserProfile
from catalog.models import MediaAsset, Product, ProductAttributeValue, ProductVariant, VariantAttribute
from catalog.serializers.storefront_product import StorefrontProductListSerializer, StorefrontProductSerializer
from commerce.models import StoreSettings

ATTRIBUTE_FILTER_PREFIX = "attr_"
RELATED_LIMIT = 8
# ?sort= value → ordering; out-of-stock products are moved to the end first when the store setting says so.
SORTS = {
    "newest": ["-created_at", "-id"],
    "cheapest": [F("min_price").asc(nulls_last=True), "-id"],
    "expensive": [F("min_price").desc(nulls_last=True), "-id"],
    "discount": [F("max_discount").desc(nulls_last=True), "-id"],
    "popular": ["-sold_quantity", "-id"],
    "rating": [F("rating_average").desc(nulls_last=True), "-rating_count", "-id"],
}


def caller_tier(request: Request) -> str:
    return UserProfile.tier_of(request.user) if request.user.is_authenticated else UserProfile.CustomerTier.RETAIL


def storefront_products() -> QuerySet:
    return Product.storefront().select_related("category", "brand", "unit").prefetch_related(
        Prefetch("variants", queryset=ProductVariant.objects.prefetch_related("attributes__attribute")),
        Prefetch("media", queryset=MediaAsset.objects.order_by("sort_order", "id")),
    )


class StorefrontContextMixin:
    def get_serializer_context(self) -> dict:
        new_since, bestsellers = Product.badge_rules()
        return {**super().get_serializer_context(), "tier": caller_tier(self.request), "new_since": new_since,
                "bestsellers": bestsellers}


class StorefrontProductListView(StorefrontContextMixin, generics.ListAPIView):
    """``GET /api/shop/products/`` (public, paginated). Filters: ``search``, ``category`` (slug or id, includes
    subcategories), ``brand`` (ids, comma separated), ``tag`` (slug), ``min_price``/``max_price`` (cheapest retail
    price), ``in_stock=true``, ``attr_<attribute id>=v1,v2``. ``sort``: newest (default), cheapest, expensive,
    discount, popular, rating.
    """

    permission_classes = [AllowAny]
    serializer_class = StorefrontProductListSerializer

    def get_queryset(self) -> QuerySet:
        params = self.request.query_params
        products = storefront_products()
        if search := params.get("search", "").strip():
            products = products.filter(Q(name__icontains=search) | Q(description_short__icontains=search))
        if category := params.get("category"):
            match = Q(category_id=category) | Q(category__parent_id=category) if category.isdigit() else (
                Q(category__slug=category) | Q(category__parent__slug=category)
            )
            products = products.filter(match)
        if brands := [pk for pk in params.get("brand", "").split(",") if pk.isdigit()]:
            products = products.filter(brand_id__in=brands)
        if tag := params.get("tag"):
            products = products.filter(pk__in=Product.objects.filter(tags__slug=tag, tags__is_active=True).values("pk"))
        for name, lookup in (("min_price", "min_price__gte"), ("max_price", "min_price__lte")):
            if value := params.get(name):
                try:
                    products = products.filter(**{lookup: Decimal(value)})
                except InvalidOperation:
                    pass
        if params.get("in_stock") == "true":
            products = products.filter(in_stock=True)
        for key in params:
            attribute_id = key.removeprefix(ATTRIBUTE_FILTER_PREFIX)
            if key.startswith(ATTRIBUTE_FILTER_PREFIX) and attribute_id.isdigit():
                values = params[key].split(",")
                # Subqueries, not joins, so the review aggregates are not multiplied.
                products = products.filter(
                    Q(pk__in=ProductAttributeValue.objects.filter(attribute_id=attribute_id, value__in=values)
                      .values("product_id"))
                    | Q(pk__in=VariantAttribute.objects.filter(attribute_id=attribute_id, value__in=values)
                        .values("variant__product_id"))
                )
        ordering = SORTS.get(params.get("sort", ""), SORTS["newest"])
        if StoreSettings.get_solo().out_of_stock_display == StoreSettings.OutOfStockDisplay.MOVE_TO_END:
            ordering = ["-in_stock", *ordering]
        return products.order_by(*ordering)


class StorefrontProductDetailView(StorefrontContextMixin, generics.RetrieveAPIView):
    """``GET /api/shop/products/{slug}/`` (public)."""

    permission_classes = [AllowAny]
    serializer_class = StorefrontProductSerializer
    lookup_field = "slug"

    def get_queryset(self) -> QuerySet:
        return storefront_products().prefetch_related("attribute_values__attribute")


class StorefrontRelatedProductsView(StorefrontContextMixin, generics.GenericAPIView):
    """``GET /api/shop/products/{slug}/related/`` — up to 8 in-stock-first products from the same category, filled
    from other categories when it has too few (public).
    """

    permission_classes = [AllowAny]
    serializer_class = StorefrontProductListSerializer

    def get(self, request: Request, slug: str) -> Response:
        product = get_object_or_404(Product.storefront(), slug=slug)
        others = storefront_products().exclude(pk=product.pk).order_by("-in_stock", "-sold_quantity", "-id")
        related = list(others.filter(category=product.category)[:RELATED_LIMIT])
        if len(related) < RELATED_LIMIT:
            related += list(others.exclude(category=product.category)[: RELATED_LIMIT - len(related)])
        return Response(self.get_serializer(related, many=True).data)
