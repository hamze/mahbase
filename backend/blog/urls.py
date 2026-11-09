from django.urls import path
from rest_framework.routers import SimpleRouter

from blog import views

router = SimpleRouter()
router.register("categories", views.PublicBlogCategoryViewSet, basename="blog-category")
router.register("posts", views.PublicBlogPostViewSet, basename="blog-post")

urlpatterns = [
    path("internal-pages/<slug:slug>/", views.InternalPageView.as_view(), name="blog-internal-page"),
    *router.urls,
]
