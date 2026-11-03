import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { AdminNav } from "@/components/AdminNav";
import { PermissionsProvider } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n/fa";
import { logout } from "@/lib/server/actions";
import { getCurrentUser } from "@/lib/server/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // The panel is for staff only; customers authenticate with OTP in the storefront.
  if (!user?.is_staff) redirect("/manage/login");
  return (
    <PermissionsProvider permissions={user.permissions}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">م</span>
            <strong>{t("app.title")}</strong>
          </div>
          <AdminNav />
        </aside>
        <div className="content">
          <header className="topbar">
            <span className="muted">{t("app.title")}</span>
            <div className="row">
              <span className="avatar" aria-hidden="true">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
              <span>{user.username}</span>
              <form action={logout}>
                <button type="submit" className="ghost">
                  {t("nav.logout")}
                </button>
              </form>
            </div>
          </header>
          <main className="main">{children}</main>
        </div>
      </div>
    </PermissionsProvider>
  );
}
