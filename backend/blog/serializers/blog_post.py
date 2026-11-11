from django.db import transaction
from rest_framework import serializers

from blog.models import BlogPost
from catalog.models import MediaAsset


class PublicBlogPostSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    author_name = serializers.CharField(source="author.get_full_name", read_only=True)
    tags = serializers.SlugRelatedField(slug_field="slug", many=True, read_only=True)

    class Meta:
        model = BlogPost
        fields = [
            "id", "title", "slug", "category", "category_name", "category_slug", "excerpt", "content",
            "cover_image_url", "author_name", "published_at", "seo_title", "seo_description", "canonical_url", "tags",
        ]
        read_only_fields = fields

    def get_cover_image_url(self, post: BlogPost) -> str | None:
        return post.cover_image.file.url if post.cover_image else None


class BlogPostSerializer(serializers.ModelSerializer):
    """Admin create/update. Status changes only through ``publish``.

    ``cover_image`` is a new temporary upload (claimed as BLOG_COVER) or the current cover; ``content_images`` lists
    the ids of editor images still in the content (read back as ``{id, url}``): new temporary uploads are claimed as
    BLOG_CONTENT, dropped ones released.
    """

    category_name = serializers.CharField(source="category.name", read_only=True)
    author_name = serializers.CharField(source="author.username", read_only=True)
    cover_image = serializers.PrimaryKeyRelatedField(
        queryset=MediaAsset.objects.all(), allow_null=True, required=False
    )
    cover_image_url = serializers.SerializerMethodField()
    content_images = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = BlogPost
        fields = [
            "id", "title", "slug", "category", "category_name", "excerpt", "content", "cover_image", "cover_image_url",
            "content_images", "author", "author_name", "status", "published_at", "is_internal_page", "seo_title",
            "seo_description", "canonical_url", "tags", "created_at", "updated_at",
        ]
        read_only_fields = ["author", "status", "published_at", "is_internal_page", "created_at", "updated_at"]

    def get_cover_image_url(self, post: BlogPost) -> str | None:
        return post.cover_image.file.url if post.cover_image else None

    def validate_cover_image(self, cover: MediaAsset | None) -> MediaAsset | None:
        if cover is None or cover.image_type == MediaAsset.ImageType.TEMPORARY:
            return cover
        if self.instance is not None and cover.blog_post_id == self.instance.pk:
            return cover
        raise serializers.ValidationError("تصویر کاور باید آپلود جدید یا کاور فعلی همین نوشته باشد.")

    def create(self, validated_data: dict) -> BlogPost:
        tags = validated_data.pop("tags", [])
        cover = validated_data.pop("cover_image", None)
        content_images = validated_data.pop("content_images", [])
        with transaction.atomic():
            post = BlogPost.objects.create(**validated_data)
            post.tags.set(tags)
            self._set_cover(post, cover)
            self._set_content_images(post, content_images)
        return post

    def update(self, post: BlogPost, validated_data: dict) -> BlogPost:
        tags = validated_data.pop("tags", None)
        has_cover = "cover_image" in validated_data
        cover = validated_data.pop("cover_image", None)
        content_images = validated_data.pop("content_images", None)
        with transaction.atomic():
            post = super().update(post, validated_data)
            if tags is not None:
                post.tags.set(tags)
            if has_cover:
                self._set_cover(post, cover)
            if content_images is not None:
                self._set_content_images(post, content_images)
        return post

    def _set_cover(self, post: BlogPost, cover: MediaAsset | None) -> None:
        previous_id = post.cover_image_id
        if cover is not None and cover.image_type == MediaAsset.ImageType.TEMPORARY:
            MediaAsset.claim([(cover.pk, MediaAsset.ImageType.BLOG_COVER)], blog_post=post)
        post.cover_image = cover
        post.save(update_fields=["cover_image", "updated_at"])
        if previous_id is not None and previous_id != post.cover_image_id:
            MediaAsset.release(pk=previous_id)

    def _set_content_images(self, post: BlogPost, ids: list[int]) -> None:
        owned = set(
            MediaAsset.objects.filter(blog_post=post, image_type=MediaAsset.ImageType.BLOG_CONTENT)
            .values_list("pk", flat=True)
        )
        MediaAsset.release(pk__in=owned - set(ids))
        MediaAsset.claim([(pk, MediaAsset.ImageType.BLOG_CONTENT) for pk in ids if pk not in owned], blog_post=post)

    def to_representation(self, post: BlogPost) -> dict:
        data = super().to_representation(post)
        data["content_images"] = [
            {"id": asset.pk, "url": asset.file.url}
            for asset in post.media.all()
            if asset.image_type == MediaAsset.ImageType.BLOG_CONTENT
        ]
        return data


class BlogPostStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=BlogPost.Status.choices, default=BlogPost.Status.PUBLISHED)
