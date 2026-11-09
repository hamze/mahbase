from rest_framework import serializers

from commerce.models import City, Province


class ProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Province
        fields = ["id", "name"]


class CitySerializer(serializers.ModelSerializer):
    province_name = serializers.CharField(source="province.name", read_only=True)

    class Meta:
        model = City
        fields = ["id", "name", "province", "province_name"]


class AdminProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Province
        fields = ["id", "name", "is_active"]


class AdminCitySerializer(serializers.ModelSerializer):
    province_name = serializers.CharField(source="province.name", read_only=True)

    class Meta:
        model = City
        fields = ["id", "name", "province", "province_name", "is_active"]
