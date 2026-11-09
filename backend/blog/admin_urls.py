from rest_framework.routers import SimpleRouter

from blog import views

router = SimpleRouter()
router.register("categories", views.AdminBlogCategoryViewSet, basename="admin-blog-category")
router.register("posts", views.AdminBlogPostViewSet, basename="admin-blog-post")

urlpatterns = router.urls
