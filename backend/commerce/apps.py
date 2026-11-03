from django.apps import AppConfig


class CommerceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "commerce"

    def ready(self) -> None:
        from django.contrib.auth.signals import user_logged_in

        from commerce.receivers import merge_guest_cart

        user_logged_in.connect(merge_guest_cart, dispatch_uid="commerce.merge_guest_cart")
