"""The one registry of RBAC codes. A new module adds its codes here and runs ``manage.py seed_permissions``
(the data migration seeds the same list); superusers need no change, groups are updated by an admin.
"""

# (code, module, label_fa)
BASELINE_PERMISSIONS: list[tuple[str, str, str]] = [
    ("access.view", "access", "مشاهده گروه‌ها و مجوزها"),
    ("access.manage_groups", "access", "مدیریت گروه‌های کاربری"),
    ("access.manage_users", "access", "مدیریت دسترسی کاربران"),
    ("categories.view", "categories", "مشاهده دسته‌بندی‌ها"),
    ("categories.manage", "categories", "مدیریت دسته‌بندی‌ها"),
    ("tags.view", "tags", "مشاهده تگ‌ها"),
    ("tags.manage", "tags", "مدیریت تگ‌ها"),
    ("brands.view", "brands", "مشاهده برندها"),
    ("brands.manage", "brands", "مدیریت برندها"),
    ("attributes.view", "attributes", "مشاهده ویژگی‌ها"),
    ("attributes.manage", "attributes", "مدیریت ویژگی‌ها"),
    ("units.view", "units", "مشاهده واحدها"),
    ("units.manage", "units", "مدیریت واحدها"),
    ("media.view", "media", "مشاهده تصاویر"),
    ("media.manage", "media", "مدیریت تصاویر"),
    ("products.view", "products", "مشاهده محصولات"),
    ("products.create", "products", "ایجاد محصول"),
    ("products.edit", "products", "ویرایش محصول"),
    ("products.publish", "products", "انتشار محصول"),
    ("products.delete", "products", "حذف و بازگردانی محصول"),
    ("products.edit_price", "products", "ویرایش قیمت"),
    ("products.edit_stock", "products", "ویرایش موجودی"),
    ("admin.users.view", "users", "مشاهده مشتریان"),
    ("admin.users.create", "users", "ایجاد مشتری"),
    ("admin.users.edit", "users", "ویرایش مشتری"),
    ("admin.users.tier", "users", "تغییر نوع مشتری"),
    ("admin.users.block", "users", "مسدود و غیرفعال‌سازی مشتری"),
    ("admin.orders.view_all", "orders", "مشاهده همه سفارش‌ها"),
    ("admin.orders.create", "orders", "ثبت سفارش برای مشتری"),
    ("admin.orders.edit", "orders", "ویرایش سفارش"),
    ("admin.orders.status", "orders", "تغییر وضعیت سفارش"),
    ("admin.orders.cancel", "orders", "لغو سفارش"),
    ("admin.refunds.approve", "orders", "تأیید استرداد"),
    ("admin.refunds.complete", "orders", "تکمیل استرداد"),
    ("admin.returns.approve", "orders", "تأیید مرجوعی"),
    ("admin.returns.receive", "orders", "دریافت کالای مرجوعی"),
    ("admin.returns.complete", "orders", "تکمیل مرجوعی"),
    ("admin.discounts.manage", "sales", "مدیریت کدهای تخفیف"),
    ("admin.shipping.manage", "sales", "مدیریت روش‌های ارسال"),
    ("geo.manage", "geo", "مدیریت استان‌ها و شهرها"),
    ("admin.faqs.manage", "content", "مدیریت پرسش‌های متداول"),
    ("admin.product_questions.answer", "content", "پاسخ به پرسش محصولات"),
    ("admin.audit.view", "audit", "مشاهده گزارش رویدادها"),
    ("blog.view", "blog", "مشاهده مطالب بلاگ"),
    ("blog.manage_categories", "blog", "مدیریت دسته‌های بلاگ"),
    ("blog.create", "blog", "ایجاد مطلب"),
    ("blog.edit", "blog", "ویرایش مطلب"),
    ("blog.publish", "blog", "انتشار مطلب"),
    ("blog.delete", "blog", "حذف مطلب"),
    ("notifications.view", "notifications", "مشاهده اعلان‌ها"),
    ("notifications.manage", "notifications", "تغییر وضعیت اعلان‌ها"),
    ("contact_messages.view", "contact_messages", "مشاهده پیام‌های تماس"),
    ("contact_messages.manage", "contact_messages", "تغییر وضعیت پیام‌های تماس"),
    ("reviews.view", "reviews", "مشاهده نظرات"),
    ("reviews.moderate", "reviews", "تأیید و رد نظرات"),
    ("reviews.delete", "reviews", "حذف نظرات"),
    ("settings.view", "settings", "مشاهده تنظیمات فروشگاه"),
    ("settings.edit", "settings", "ویرایش تنظیمات فروشگاه"),
    ("banners.view", "banners", "مشاهده بنرها"),
    ("banners.manage", "banners", "مدیریت بنرها"),
]

ADMIN_GROUP_SLUG = "admin"


def seed_permissions(permission_model: type, group_model: type) -> None:
    """Upsert every baseline code (labels may change, codes never do) and create the system admin group once.

    Takes the model classes so the data migration can pass its historical models.
    """
    for code, module, label_fa in BASELINE_PERMISSIONS:
        permission_model.objects.update_or_create(code=code, defaults={"module": module, "label_fa": label_fa})
    group, created = group_model.objects.get_or_create(
        slug=ADMIN_GROUP_SLUG, defaults={"name": "مدیران", "is_system": True}
    )
    if created:
        group.permissions.set(permission_model.objects.all())
