import io

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import Group, GroupMembership
from accounts.permissions import has_permission, resolved_permissions
from catalog.tests.helpers import make_staff


class RBACTests(TestCase):
    def test_superuser_from_createsuperuser_bypasses_group_permissions(self) -> None:
        call_command(
            "createsuperuser", "--noinput", username="root", email="root@example.com", stdout=io.StringIO()
        )
        client = APIClient()
        client.force_authenticate(User.objects.get(username="root"))

        self.assertEqual(client.get("/api/access/users/").status_code, 200)
        me = client.get("/api/auth/me/").data
        self.assertTrue(me["is_superuser"])
        self.assertIn("settings.edit", me["permissions"])

    def test_inactive_superuser_holds_no_permissions(self) -> None:
        root = User.objects.create_superuser("root", "root@example.com", "pw", is_active=False)

        self.assertFalse(has_permission(root, "settings.edit"))
        self.assertEqual(resolved_permissions(root), [])

    def test_group_permissions_gate_the_api(self) -> None:
        client = APIClient()
        client.force_authenticate(make_staff("viewer", ("access.view",)))

        self.assertEqual(client.get("/api/access/groups/").status_code, 200)
        self.assertEqual(client.post("/api/access/groups/", {"name": "x", "slug": "x"}).status_code, 403)
        self.assertEqual(client.get("/api/access/users/").status_code, 403)

        client.force_authenticate(User.objects.create_user("nogroup", password="pw", is_staff=True))
        self.assertEqual(client.get("/api/access/groups/").status_code, 403)
        self.assertEqual(client.get("/api/auth/me/").data["permissions"], [])

    def test_group_change_is_applied_on_token_refresh(self) -> None:
        user = make_staff("editor", ("blog.view",))
        tokens = APIClient().post("/api/auth/token/", {"username": "editor", "password": "pw"}).data
        self.assertEqual(AccessToken(tokens["access"])["permissions"], ["blog.view"])

        writers = Group.objects.create(name="writers", slug="writers")
        writers.replace_permissions(list(Group.objects.get(slug="admin").permissions.filter(code="blog.create")))
        GroupMembership.assign(user, writers)
        refreshed = APIClient().post("/api/auth/token/refresh/", {"refresh": tokens["refresh"]}).data

        access = AccessToken(refreshed["access"])
        self.assertEqual((access["permissions"], access["is_superuser"]), (["blog.create"], False))

    def test_group_put_replaces_permissions_and_system_group_is_protected(self) -> None:
        client = APIClient()
        client.force_authenticate(make_staff("boss", ("access.view", "access.manage_groups")))
        group = Group.objects.create(name="support", slug="support")

        response = client.put(
            f"/api/access/groups/{group.pk}/",
            {"name": "support", "slug": "support", "permissions": ["reviews.view", "reviews.moderate"]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(sorted(response.data["permissions"]), ["reviews.moderate", "reviews.view"])
        system = Group.objects.get(slug="admin")
        self.assertEqual(client.delete(f"/api/access/groups/{system.pk}/").status_code, 400)
        self.assertTrue(Group.objects.filter(pk=system.pk).exists())
