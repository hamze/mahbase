from django.contrib.auth.models import User
from django.http import HttpRequest

from commerce.models import Cart
from commerce.services.cart import SESSION_CART_KEY, SESSION_MERGE_WARNINGS_KEY


def merge_guest_cart(sender: type, request: HttpRequest, user: User, **kwargs: object) -> None:
    """``user_logged_in``: merge the session cart into the database cart; warnings show on the next cart read."""
    session_items = request.session.get(SESSION_CART_KEY)
    if not session_items or user.is_staff:
        return
    request.session[SESSION_MERGE_WARNINGS_KEY] = Cart.merge_session(user, session_items)
    del request.session[SESSION_CART_KEY]
