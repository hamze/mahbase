from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("catalog.urls")),
]

# django.conf.urls.static.static() is a no-op when DEBUG is off, which made every uploaded image 404 when Django
# was run directly. In the Compose stack nginx answers /media/ before requests reach Django.
if settings.SERVE_MEDIA:
    urlpatterns.append(
        re_path(rf"^{settings.MEDIA_URL.strip('/')}/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT})
    )
