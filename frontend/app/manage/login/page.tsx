"use client";

import { useActionState } from "react";

import { login, LoginState } from "@/lib/server/actions";
import { t } from "@/lib/i18n/fa";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: false });
  return (
    <main className="login-page">
      <form action={action} className="card login-card">
        <div className="brand">
          <span className="brand-mark">م</span>
          <strong>{t("app.title")}</strong>
        </div>
        <h1>{t("login.title")}</h1>
        <label>
          {t("login.username")}
          <input name="username" autoComplete="username" required />
        </label>
        <label style={{ marginTop: 12 }}>
          {t("login.password")}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {state.error && <p className="errors">{t("login.failed")}</p>}
        <button className="primary block" type="submit" disabled={pending} style={{ marginTop: 20 }}>
          {t("login.submit")}
        </button>
      </form>
    </main>
  );
}
