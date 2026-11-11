from typing import Any

from rest_framework.renderers import JSONRenderer

from config.api.responses import Responses


class EnvelopeJSONRenderer(JSONRenderer):
    """Wraps a plain view result as ``{"state": "success", "message": "success", "data": ...}``.

    Responses built by ``Responses.get_response`` (all errors and explicit success types) are already wrapped;
    204 responses keep an empty body.
    """

    def render(self, data: Any, accepted_media_type: str | None = None, renderer_context: dict | None = None) -> bytes:
        response = (renderer_context or {}).get("response")
        if response is not None and response.status_code != 204 and not getattr(response, "is_enveloped", False):
            data = Responses.body(Responses.GENERAL.OK, data)
        return super().render(data, accepted_media_type, renderer_context)
