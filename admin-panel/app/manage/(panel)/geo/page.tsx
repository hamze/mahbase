"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ActiveBadge, ResourceManager } from "@/components/ResourceManager";
import { listAll } from "@/lib/api/catalog";
import { t } from "@/lib/i18n/fa";

type Province = { id: number; name: string };

const loadProvinces = async () =>
  (await listAll<Province>("admin/provinces")).map((province) => ({
    value: province.id,
    label: province.name,
  }));

export default function GeoPage() {
  const [province, setProvince] = useState<Province | null>(null);
  const cityQuery = useMemo(
    () => (province ? { province: String(province.id) } : undefined),
    [province],
  );
  const citiesPanel = useRef<HTMLElement>(null);
  // On narrow screens the panel stacks below the 31 provinces; bring it into view when a province is picked.
  useEffect(() => {
    citiesPanel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [province]);

  return (
    <>
      <h1>{t("nav.geo")}</h1>
      <div className="geo-layout">
        <section>
          <ResourceManager
            resource="admin/provinces"
            section="geo"
            permission="geo.manage"
            emptyForm={{ name: "", is_active: true }}
            fields={[
              { name: "name", label: "field.name", kind: "text" },
              { name: "is_active", label: "field.is_active", kind: "checkbox" },
            ]}
            columns={[
              { label: "field.province", render: (row) => String(row.name) },
              {
                label: "field.is_active",
                render: (row) => <ActiveBadge active={row.is_active} />,
              },
            ]}
            rowActions={(row) => (
              <button
                className={province?.id === row.id ? "primary" : undefined}
                onClick={() =>
                  setProvince({ id: row.id, name: String(row.name) })
                }
              >
                {t("geo.showCities")}
              </button>
            )}
          />
        </section>
        <section className="geo-cities" ref={citiesPanel}>
          {!province && <p className="card muted">{t("geo.pickProvince")}</p>}
          {province && (
            <>
              <h2>{t("geo.citiesOf", { name: province.name })}</h2>
              <ResourceManager
                key={province.id}
                resource="admin/cities"
                permission="geo.manage"
                query={cityQuery}
                emptyForm={{ name: "", province: province.id, is_active: true }}
                fields={[
                  { name: "name", label: "field.name", kind: "text" },
                  {
                    name: "province",
                    label: "field.province",
                    kind: "select",
                    loadOptions: loadProvinces,
                  },
                  {
                    name: "is_active",
                    label: "field.is_active",
                    kind: "checkbox",
                  },
                ]}
                columns={[
                  { label: "field.city", render: (row) => String(row.name) },
                  {
                    label: "field.is_active",
                    render: (row) => <ActiveBadge active={row.is_active} />,
                  },
                ]}
              />
            </>
          )}
        </section>
      </div>
    </>
  );
}
