from django.test import TestCase
from rest_framework.test import APIClient

from catalog.tests.helpers import make_staff
from commerce.models import City, DiscountCode, Province
from commerce.tests.helpers import ShopFixture


class GeoTests(TestCase):
    def setUp(self) -> None:
        self.admin = APIClient()
        self.admin.force_authenticate(make_staff("geo-admin", ("geo.manage",)))

    def test_iran_divisions_are_seeded_and_public_cities_name_their_province(self) -> None:
        self.assertEqual(Province.objects.count(), 31)
        self.assertGreater(City.objects.count(), 1400)
        self.assertFalse(City.objects.filter(name__regex=r"\d").exists())
        tehran = Province.objects.get(name="تهران")
        cities = APIClient().get("/api/geo/cities/", {"province_id": tehran.pk}).data
        self.assertIn({"id": City.objects.get(province=tehran, name="تهران").pk, "name": "تهران",
                       "province": tehran.pk, "province_name": "تهران"}, cities)

    def test_admin_geo_needs_the_permission_and_deactivates_a_city_in_use(self) -> None:
        other = APIClient()
        other.force_authenticate(make_staff("no-geo", ("admin.shipping.manage",)))
        self.assertEqual(other.get("/api/admin/provinces/").status_code, 403)

        used_city = ShopFixture().customer("09120000001")[1].city
        response = self.admin.delete(f"/api/admin/cities/{used_city.pk}/")
        self.assertEqual(response.data, {"id": used_city.pk, "deactivated": True})
        self.assertFalse(City.objects.get(pk=used_city.pk).is_active)

        created = self.admin.post("/api/admin/cities/", {"name": "شهر نو", "province": used_city.province_id})
        self.assertEqual(created.status_code, 201)
        duplicate = self.admin.post("/api/admin/cities/", {"name": "شهر نو", "province": used_city.province_id})
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(self.admin.delete(f"/api/admin/cities/{created.data['id']}/").status_code, 204)


class DiscountGenerateTests(TestCase):
    def test_bulk_codes_are_single_use_for_anyone_with_the_shared_settings(self) -> None:
        admin = APIClient()
        admin.force_authenticate(make_staff("discount-admin", ("admin.discounts.manage",)))
        payload = {
            "code": "nowruz", "count": 3, "product_discount_type": "PERCENTAGE", "percentage": "15",
            "max_discount_amount": "50000", "min_eligible_subtotal": "100000", "ends_at": "2030-01-01T00:00:00Z",
            "specific_mobile": "09120000001", "usage_limit_total": 9, "per_user_limit": 9,
        }
        response = admin.post("/api/admin/discount-codes/generate/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        codes = DiscountCode.objects.filter(code__startswith="NOWRUZ")
        self.assertEqual(codes.count(), 3)
        for code in codes:
            self.assertEqual(
                (code.specific_mobile, code.usage_limit_total, code.per_user_limit, str(code.max_discount_amount)),
                ("", 1, 1, "50000.00"),
            )
