from rest_framework.routers import SimpleRouter

from accounts import views

router = SimpleRouter()
router.register("permissions", views.AccessPermissionViewSet, basename="access-permission")
router.register("groups", views.AccessGroupViewSet, basename="access-group")
router.register("users", views.AccessUserViewSet, basename="access-user")

urlpatterns = router.urls
