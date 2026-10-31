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

urlpatterns = router.urls
