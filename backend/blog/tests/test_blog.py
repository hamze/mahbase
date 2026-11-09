from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from blog.models import INTERNAL_PAGES_SLUG, BlogCategory, BlogPost
from catalog.models import Brand, MediaAsset
from catalog.tests.helpers import make_staff, png_upload


class BlogVisibilityTests(TestCase):
    def setUp(self) -> None:
        self.staff = make_staff("writer", ("blog.view", "blog.create", "blog.publish", "blog.delete"))
        self.admin = APIClient()
        self.admin.force_authenticate(self.staff)
        self.internal = BlogCategory.objects.get(slug=INTERNAL_PAGES_SLUG)
        self.news = BlogCategory.objects.create(name="News", slug="news")

    def create_post(self, slug: str, category: BlogCategory) -> int:
        response = self.admin.post(
            "/api/admin/blog/posts/",
            {"title": slug, "slug": slug, "category": category.pk, "content": "<p>x</p><script>bad()</script>"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.admin.patch(f"/api/admin/blog/posts/{response.data['id']}/publish/", {}, format="json")
        return response.data["id"]

    def test_internal_pages_stay_out_of_the_public_blog(self) -> None:
        self.create_post("hello", self.news)
        about = self.create_post("about", self.internal)
        public = APIClient()

        listing = public.get("/api/blog/posts/").data["results"]
        self.assertEqual([post["slug"] for post in listing], ["hello"])
        self.assertNotIn("<script>", listing[0]["content"])
        self.assertEqual(public.get("/api/blog/posts/about/").status_code, 404)
        self.assertEqual(public.get("/api/blog/internal-pages/about/").status_code, 200)
        self.assertEqual(public.get("/api/blog/internal-pages/hello/").status_code, 404)
        self.assertNotIn(INTERNAL_PAGES_SLUG, [c["slug"] for c in public.get("/api/blog/categories/").data["results"]])

        self.admin.patch(f"/api/admin/blog/posts/{about}/publish/", {"status": "DRAFT"}, format="json")
        self.assertEqual(public.get("/api/blog/internal-pages/about/").status_code, 404)

        self.admin.patch(f"/api/admin/blog/posts/{about}/publish/", {}, format="json")
        BlogCategory.objects.filter(pk=self.internal.pk).update(is_active=False)
        self.assertEqual(public.get("/api/blog/internal-pages/about/").status_code, 404)

    def test_upload_to_owner_needs_owner_write_permission_and_delete_releases_media(self) -> None:
        post = self.create_post("hello", self.news)
        brand = Brand.objects.create(name="Acme", slug="acme")

        denied = self.admin.post(
            "/api/media/upload/",
            {"file": png_upload(), "brand": brand.pk, "image_type": "brand_logo"},
            format="multipart",
        )
        self.assertEqual(denied.status_code, 403)
        owned = self.admin.post(
            "/api/media/upload/",
            {"file": png_upload(), "blog_post": post, "image_type": "blog_content"},
            format="multipart",
        )
        self.assertEqual(owned.status_code, 201, owned.data)

        self.assertEqual(self.admin.delete(f"/api/admin/blog/posts/{post}/").status_code, 204)
        asset = MediaAsset.objects.get(pk=owned.data["id"])
        self.assertEqual((asset.image_type, asset.blog_post_id), (MediaAsset.ImageType.TEMPORARY, None))

    def test_admin_routes_enforce_blog_permissions(self) -> None:
        reader = APIClient()
        reader.force_authenticate(make_staff("reader", ("blog.view",)))
        post = self.create_post("hello", self.news)

        self.assertEqual(reader.get("/api/admin/blog/posts/").status_code, 200)
        self.assertEqual(reader.patch(f"/api/admin/blog/posts/{post}/publish/", {}).status_code, 403)
        self.assertEqual(reader.delete(f"/api/admin/blog/posts/{post}/").status_code, 403)
        self.assertEqual(reader.post("/api/admin/blog/categories/", {"name": "x", "slug": "x"}).status_code, 403)

    @override_settings(SITE_MENU_INTERNAL_PAGES=["about"])
    def test_menu_linked_internal_page_cannot_be_deleted(self) -> None:
        about = self.create_post("about", self.internal)

        self.assertEqual(self.admin.delete(f"/api/admin/blog/posts/{about}/").status_code, 400)
        self.assertIsNone(BlogPost.objects.get(pk=about).deleted_at)
