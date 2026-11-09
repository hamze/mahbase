import logging

from django.db.models import Q, QuerySet
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from blog.models import BlogPost
from blog.serializers import BlogPostSerializer, BlogPostStatusSerializer, PublicBlogPostSerializer
from catalog.models import MediaAsset

logger = logging.getLogger(__name__)


class PublicBlogPostViewSet(viewsets.ReadOnlyModelViewSet):
    """``GET /api/blog/posts/[{slug}/]?category=&tag=`` — published blog posts; internal pages never appear."""

    permission_classes = [AllowAny]
    serializer_class = PublicBlogPostSerializer
    lookup_field = "slug"

    def get_queryset(self) -> QuerySet:
        posts = BlogPost.public().select_related("category", "author", "cover_image").prefetch_related("tags")
        params = self.request.query_params
        if category := params.get("category"):
            posts = posts.filter(Q(category__slug=category) | Q(category__parent__slug=category))
        if tag := params.get("tag"):
            posts = posts.filter(tags__slug=tag)
        return posts.order_by("-published_at", "-id")


class InternalPageView(generics.RetrieveAPIView):
    """``GET /api/blog/internal-pages/{slug}/`` — a published post of the internal category (site menu pages)."""

    permission_classes = [AllowAny]
    serializer_class = PublicBlogPostSerializer
    lookup_field = "slug"

    def get_queryset(self) -> QuerySet:
        return BlogPost.internal_pages().select_related("category", "author", "cover_image").prefetch_related("tags")


class AdminBlogPostViewSet(viewsets.ModelViewSet):
    """``/api/admin/blog/posts/`` — every non-deleted post including drafts and internal pages.
    DELETE soft-deletes; ``publish`` (PATCH ``{status}``, default PUBLISHED) sets status and ``published_at``.
    """

    serializer_class = BlogPostSerializer
    rbac_permissions = {
        "list": "blog.view",
        "retrieve": "blog.view",
        "create": "blog.create",
        "update": "blog.edit",
        "partial_update": "blog.edit",
        "publish": "blog.publish",
        "destroy": "blog.delete",
    }

    def get_queryset(self) -> QuerySet:
        posts = (
            BlogPost.objects.filter(deleted_at__isnull=True)
            .select_related("category", "author", "cover_image")
            .prefetch_related("tags", "media")
        )
        params = self.request.query_params
        if post_status := params.get("status"):
            posts = posts.filter(status=post_status)
        if category := params.get("category"):
            posts = posts.filter(category_id=category)
        if internal := params.get("is_internal_page"):
            posts = posts.filter(is_internal_page=internal == "true")
        if search := params.get("search"):
            posts = posts.filter(Q(title__icontains=search) | Q(slug__icontains=search))
        return posts

    def perform_create(self, serializer: BaseSerializer) -> None:
        serializer.save(author=self.request.user)

    def perform_destroy(self, post: BlogPost) -> None:
        post.soft_delete()
        MediaAsset.release(blog_post=post)
        logger.info(f"User {self.request.user.pk} deleted blog post {post.pk}")

    @action(detail=True, methods=["patch"])
    def publish(self, request: Request, pk: str) -> Response:
        post = self.get_object()
        serializer = BlogPostStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post.set_status(serializer.validated_data["status"])
        return Response(self.get_serializer(post).data)
