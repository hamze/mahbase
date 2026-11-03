class AdminPermissionMixin:
    """Admin resources: every action needs staff plus ``manage_permission`` (enforced by ``RBACPermission``),
    unless ``rbac_action_permissions`` names a more specific permission for that action.
    """

    manage_permission: str
    rbac_action_permissions: dict[str, str] = {}

    @property
    def rbac_permissions(self) -> dict[str, str]:
        return {self.action: self.rbac_action_permissions.get(self.action, self.manage_permission)}
