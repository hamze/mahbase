from django.urls import path
from rest_framework.routers import DefaultRouter

from catalog import views

router = DefaultRouter()
router.register("media/upload", views.MediaUploadViewSet, basename="media-upload")
router.register("units", views.UnitViewSet, basename="unit")
router.register("categories", views.CategoryViewSet, basename="category")
router.register("tags", views.TagViewSet, basename="tag")
router.register("brands", views.BrandViewSet, basename="brand")
router.register("attributes", views.AttributeViewSet, basename="attribute")
router.register(r"attributes/(?P<attribute_pk>\d+)/options", views.AttributeOptionViewSet, basename="attribute-option")
router.register("products", views.ProductViewSet, basename="product")
router.register("variants", views.VariantViewSet, basename="variant")

urlpatterns = [
    path("shop/categories/", views.StorefrontCategoryListView.as_view(), name="shop-categories"),
    path("shop/categories/<slug:slug>/filters/", views.StorefrontCategoryFiltersView.as_view(), name="shop-filters"),
    path("shop/products/", views.StorefrontProductListView.as_view(), name="shop-products"),
    path("shop/products/<str:slug>/", views.StorefrontProductDetailView.as_view(), name="shop-product"),
    path("shop/products/<str:slug>/related/", views.StorefrontRelatedProductsView.as_view(), name="shop-related"),
    *router.urls,
]
