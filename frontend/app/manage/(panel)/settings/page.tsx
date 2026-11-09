"use client";

import { useEffect, useState } from "react";

import { Guide } from "@/components/Guide";
import { FieldLabel } from "@/components/InfoTip";
import { Messages } from "@/components/Messages";
import { errorMessages } from "@/lib/api/errors";
import { uploadTemporaryImage } from "@/lib/api/media";
import { getStoreSettings, saveStoreSettings } from "@/lib/api/site";
import type { SocialLinks, StoreSettings, TrustBadge } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n/fa";

const SOCIAL_KEYS = ["instagram", "telegram", "whatsapp", "twitter", "linkedin", "youtube", "aparat"] as const;
type TextKey = "store_name" | "primary_color" | "contact_phone" | "contact_email" | "default_profit_percentage";
type ToggleKey = "reviews_enabled" | "cod_enabled" | "sms_notifications_enabled";

/** Store settings singleton: read with settings.view, saved (full PUT) with settings.edit. */
export default function SettingsPage() {
  const can = useCan();
  const canEdit = can("settings.edit");
  const [form, setForm] = useState<StoreSettings | null>(null);
  const [logoFile, setLogoFile] = useState<File>();
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    getStoreSettings().then(setForm).catch((error) => setErrors(errorMessages(error)));
  }, []);

  if (!form) return <Messages errors={errors} />;

  const set = <K extends keyof StoreSettings>(name: K, value: StoreSettings[K]) => setForm({ ...form, [name]: value });
  const setBadge = (index: number, badge: TrustBadge) =>
    set("trust_badges", form.trust_badges.map((current, i) => (i === index ? badge : current)));

  const addBadge = async (file: File) => {
    try {
      const asset = await uploadTemporaryImage(file, form.store_name);
      set("trust_badges", [...form.trust_badges, { image_id: asset.id, link_url: "", image_url: asset.url }]);
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  const save = async () => {
    setErrors([]);
    setNotice(undefined);
    try {
      const logo = logoFile ? (await uploadTemporaryImage(logoFile, form.store_name)).id : form.logo;
      const socialLinks: SocialLinks = Object.fromEntries(
        Object.entries(form.social_links).map(([key, value]) => [key, value || null]),
      );
      const { logo_url: _logoUrl, ...data } = form;
      const saved = await saveStoreSettings({
        ...data,
        logo,
        social_links: socialLinks,
        trust_badges: form.trust_badges.map(({ image_id, link_url }) => ({ image_id, link_url })),
      });
      setForm(saved);
      setLogoFile(undefined);
      setNotice(t("common.saved"));
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  const text = (name: TextKey, ltr = false) => (
    <label key={name}>
      <FieldLabel field={name}>{t(`field.${name}`)}</FieldLabel>
      <input dir={ltr ? "ltr" : undefined} value={form[name]} onChange={(e) => set(name, e.target.value)} />
    </label>
  );

  const toggle = (name: ToggleKey) => (
    <label key={name} className="inline">
      <input type="checkbox" checked={form[name]} onChange={(e) => set(name, e.target.checked)} />
      <FieldLabel field={name}>{t(`field.${name}`)}</FieldLabel>
    </label>
  );

  return (
    <>
      <Guide section="settings" />
      <h1>{t("nav.settings")}</h1>
      <Messages errors={errors} notice={notice} />
      <fieldset disabled={!canEdit}>
        <div className="card">
          <div className="form-grid">
            {text("store_name")}
            <label>
              <FieldLabel field="logo">{t("field.logo")}</FieldLabel>
              {form.logo_url && !logoFile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo_url} alt="" width={80} />
              )}
              <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0])} />
            </label>
            {text("primary_color", true)}
            {text("contact_phone", true)}
            {text("contact_email", true)}
            {text("default_profit_percentage", true)}
            <label>
              <FieldLabel field="out_of_stock_display">{t("field.out_of_stock_display")}</FieldLabel>
              <select
                value={form.out_of_stock_display}
                onChange={(e) => set("out_of_stock_display", e.target.value as StoreSettings["out_of_stock_display"])}
              >
                <option value="SHOW_WITH_BADGE">{t("outOfStock.SHOW_WITH_BADGE")}</option>
                <option value="MOVE_TO_END">{t("outOfStock.MOVE_TO_END")}</option>
              </select>
            </label>
            <label>
              <FieldLabel field="address">{t("field.address")}</FieldLabel>
              <textarea value={form.address} onChange={(e) => set("address", e.target.value)} />
            </label>
            <label>
              <FieldLabel field="footer_text">{t("field.footer_text")}</FieldLabel>
              <textarea dir="auto" value={form.footer_text} onChange={(e) => set("footer_text", e.target.value)} />
            </label>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            {toggle("reviews_enabled")}
            {toggle("cod_enabled")}
            {toggle("sms_notifications_enabled")}
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">{t("settings.socialLinks")}</h2>
          <div className="form-grid">
            {SOCIAL_KEYS.map((key) => (
              <label key={key}>
                <span dir="ltr">{key}</span>
                <input
                  dir="ltr"
                  value={form.social_links[key] ?? ""}
                  onChange={(e) => set("social_links", { ...form.social_links, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">{t("settings.trustBadges")}</h2>
          {form.trust_badges.map((badge, index) => (
            <div key={badge.image_id} className="row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {badge.image_url && <img src={badge.image_url} alt="" width={48} />}
              <input
                className="grow"
                dir="ltr"
                placeholder={t("field.link_url")}
                value={badge.link_url}
                onChange={(e) => setBadge(index, { ...badge, link_url: e.target.value })}
              />
              <button className="danger" onClick={() => set("trust_badges", form.trust_badges.filter((_, i) => i !== index))}>
                {t("common.delete")}
              </button>
            </div>
          ))}
          <label className="file-button" style={{ marginTop: 12 }}>
            {t("common.upload")}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) addBadge(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </fieldset>
      {canEdit && (
        <button className="primary" onClick={save}>
          {t("common.save")}
        </button>
      )}
    </>
  );
}
