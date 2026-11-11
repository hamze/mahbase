"use client";

import { useState } from "react";

import { Messages } from "@/components/Messages";
import { createOption, deleteOption, updateOption } from "@/lib/api/catalog";
import { errorMessages } from "@/lib/api/errors";
import type { Attribute } from "@/lib/api/types";
import { t } from "@/lib/i18n/fa";

/** Allowed values of a Select attribute (unique per attribute; used options are deactivated, not deleted). */
export function OptionsEditor({ attribute, onChange }: { attribute: Attribute; onChange: () => void }) {
  const [value, setValue] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();

  const run = async (action: () => Promise<unknown>, message?: string) => {
    setErrors([]);
    try {
      const result = await action();
      setNotice((result as { deactivated?: boolean } | null)?.deactivated ? t("common.deactivated") : message);
      onChange();
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <strong className="muted">{t("field.options")}</strong>
      <ul>
        {attribute.options.map((option) => (
          <li key={option.id} className="row">
            <span className={option.is_active ? "" : "strike"}>{option.value}</span>
            {!option.is_active && (
              <button onClick={() => run(() => updateOption(attribute.id, option.id, { ...option, is_active: true }))}>
                {t("field.is_active")}
              </button>
            )}
            <button className="danger" onClick={() => run(() => deleteOption(attribute.id, option.id), t("common.deleted"))}>
              {t("common.delete")}
            </button>
          </li>
        ))}
      </ul>
      <div className="row">
        <input value={value} placeholder={t("field.value")} onChange={(e) => setValue(e.target.value)} />
        <button
          onClick={() =>
            run(async () => {
              await createOption(attribute.id, { value, sort_order: attribute.options.length });
              setValue("");
            }, t("common.saved"))
          }
        >
          {t("common.add")}
        </button>
      </div>
      <Messages errors={errors} notice={notice} />
    </div>
  );
}
