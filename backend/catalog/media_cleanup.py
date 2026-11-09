import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from catalog.models import MediaAsset
from catalog.models.media_asset import OWNER_FIELDS

logger = logging.getLogger(__name__)


def cleanup_temporary_media() -> int:
    """Delete unclaimed temporary uploads older than MEDIA_TEMPORARY_RETENTION_HOURS.

    Each asset is re-checked under a row lock (skipping rows a claim currently holds) so active media and
    media being claimed are never touched. If the file cannot be deleted, the row stays temporary and the
    next run retries it.
    """
    cutoff = timezone.now() - timedelta(hours=settings.MEDIA_TEMPORARY_RETENTION_HOURS)
    expired = {
        "image_type": MediaAsset.ImageType.TEMPORARY,
        **{f"{name}__isnull": True for name in OWNER_FIELDS},
        "temporary_since__lt": cutoff,
    }
    candidate_ids = list(MediaAsset.objects.filter(**expired).values_list("pk", flat=True))
    deleted = 0
    for asset_id in candidate_ids:
        with transaction.atomic():
            asset = MediaAsset.objects.select_for_update(skip_locked=True).filter(pk=asset_id, **expired).first()
            if asset is None:
                continue
            try:
                asset.file.storage.delete(asset.file.name)
            except Exception as e:
                logger.error(f"Temporary media {asset_id} file deletion failed: {str(e)}", exc_info=True)
                continue
            asset.delete()
            deleted += 1
    return deleted
