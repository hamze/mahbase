"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Guide } from "@/components/Guide";
import { Messages } from "@/components/Messages";
import { SearchSelect } from "@/components/SearchSelect";
import { ApiError } from "@/lib/api/client";
import {
  createOrder,
  listCities,
  listCustomerAddresses,
  listProvinces,
  listShippingOptions,
  searchOrderCustomers,
  searchOrderVariants,
} from "@/lib/api/commerce";
import { errorMessages } from "@/lib/api/errors";
import type {
  Address,
  AdminOrderCreate,
  AdminUser,
  City,
  CustomerTier,
  NewAddress,
  OrderCreated,
  OrderVariantOption,
  Province,
  ShippingOption,
} from "@/lib/api/types";
import { MessageKey, t } from "@/lib/i18n/fa";
import { formatNumber, plainNumber } from "@/lib/pricing";

type Line = { option: OrderVariantOption; quantity: string };
type NewCustomer = NonNullable<AdminOrderCreate["new_customer"]>;
/** 422 body: per-variant errors keyed by variant id. */
type Rejected = { lines?: Record<string, { sku: string; errors: string[] }> };

const EMPTY_CUSTOMER: NewCustomer = { mobile: "", first_name: "", last_name: "", customer_tier: "RETAIL" };
const EMPTY_ADDRESS: NewAddress = {
  title: "", receiver_name: "", receiver_mobile: "", province: 0, city: 0, address_line: "", postal_code: "", plaque: "", unit: "",
};
const ADDRESS_TEXT_FIELDS: [keyof NewAddress, MessageKey, boolean][] = [
  ["title", "field.title", true],
  ["receiver_name", "orderNew.receiverName", true],
  ["receiver_mobile", "orderNew.receiverMobile", true],
  ["postal_code", "orderNew.postalCode", true],
  ["plaque", "orders.plaque", false],
  ["unit", "orders.unit", false],
];

const newKey = () => crypto.randomUUID().replace(/-/g, "");

/** Step-by-step admin order: customer → address → items → shipping/code, with a live price summary. */
export function OrderCreator() {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customer, setCustomer] = useState<AdminUser | null>(null);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>(EMPTY_CUSTOMER);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<number | "new" | null>(null);
  const [newAddress, setNewAddress] = useState<NewAddress>(EMPTY_ADDRESS);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [lineErrors, setLineErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<OrderCreated | null>(null);
  const [copied, setCopied] = useState(false);
  // One key per form: a retry after a lost response returns the same order instead of placing a second one.
  const idempotencyKey = useRef(newKey());

  const tier: CustomerTier = mode === "existing" ? (customer?.customer_tier ?? "RETAIL") : newCustomer.customer_tier;
  const usingNewAddress = mode === "new" || addressId === "new";
  const cityId = usingNewAddress ? newAddress.city : addresses.find((address) => address.id === addressId)?.city;

  useEffect(() => {
    listProvinces().then(setProvinces).catch((error) => setErrors(errorMessages(error)));
  }, []);

  useEffect(() => {
    setCities([]);
    if (newAddress.province) listCities(newAddress.province).then(setCities).catch((error) => setErrors(errorMessages(error)));
  }, [newAddress.province]);

  useEffect(() => {
    setShippingOptions([]);
    if (!cityId) return;
    listShippingOptions(cityId)
      .then((options) => {
        setShippingOptions(options);
        setShippingId((current) => (options.some((option) => option.id === current) ? current : (options[0]?.id ?? null)));
      })
      .catch((error) => setErrors(errorMessages(error)));
  }, [cityId]);

  // Prices depend on the tier: refresh the picked lines when the customer (or the new customer's tier) changes.
  const linesRef = useRef(lines);
  linesRef.current = lines;
  useEffect(() => {
    const picked = linesRef.current;
    if (picked.length === 0) return;
    Promise.all(picked.map((line) => searchOrderVariants(line.option.sku, tier)))
      .then((results) => {
        const fresh = new Map(results.flat().map((option) => [option.id, option]));
        setLines((latest) => latest.map((line) => ({ ...line, option: fresh.get(line.option.id) ?? line.option })));
      })
      .catch((error) => setErrors(errorMessages(error)));
  }, [tier]);

  const selectCustomer = async (user: AdminUser | null) => {
    setCustomer(user);
    setAddresses([]);
    setAddressId(null);
    if (!user) return;
    try {
      const list = await listCustomerAddresses(user.id);
      setAddresses(list);
      setAddressId(list.find((address) => address.is_default)?.id ?? list[0]?.id ?? "new");
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  const addLine = (option: OrderVariantOption) =>
    setLines((current) => [...current, { option, quantity: plainNumber(option.min_purchase) }]);
  const setQuantity = (id: number, quantity: string) =>
    setLines((current) => current.map((line) => (line.option.id === id ? { ...line, quantity } : line)));
  const removeLine = (id: number) => setLines((current) => current.filter((line) => line.option.id !== id));

  const subtotal = lines.reduce((sum, line) => sum + Number(line.option.unit_price) * Number(line.quantity || 0), 0);
  const shipping = shippingOptions.find((option) => option.id === shippingId);
  const customerReady = mode === "existing" ? customer !== null : newCustomer.mobile.trim() !== "";
  const addressReady = usingNewAddress ? Boolean(newAddress.city && newAddress.address_line && newAddress.receiver_name) : addressId !== null;
  const canSubmit = customerReady && addressReady && lines.length > 0 && shippingId !== null && !submitting;

  const submit = async () => {
    if (shippingId === null) return;
    setErrors([]);
    setLineErrors({});
    setSubmitting(true);
    try {
      const result = await createOrder(
        {
          customer: mode === "existing" ? (customer?.id ?? null) : null,
          new_customer: mode === "new" ? newCustomer : null,
          address: usingNewAddress ? null : (addressId as number),
          new_address: usingNewAddress ? newAddress : null,
          shipping_method: shippingId,
          discount_code: discountCode.trim(),
          items: lines.map((line) => ({ variant: line.option.id, quantity: line.quantity })),
        },
        idempotencyKey.current,
      );
      setCreated(result);
    } catch (error) {
      const rejected = error instanceof ApiError && error.status === 422 ? (error.data as Rejected) : null;
      if (rejected?.lines) {
        setLineErrors(Object.fromEntries(Object.entries(rejected.lines).map(([id, line]) => [id, line.errors])));
        setErrors([t("orderNew.linesRejected")]);
      } else {
        setErrors(errorMessages(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    idempotencyKey.current = newKey();
    setCreated(null);
    setCopied(false);
    setLines([]);
    setDiscountCode("");
    setNewCustomer(EMPTY_CUSTOMER);
    setNewAddress(EMPTY_ADDRESS);
    selectCustomer(null);
  };

  if (created) {
    return (
      <>
        <h1>{t("orderNew.title")}</h1>
        <div className="card">
          <div className="notice">{t("orderNew.created", { number: created.order_number })}</div>
          <label>
            {t("orderNew.paymentLink")}
            <div className="row">
              <input className="grow" dir="ltr" readOnly value={created.payment_redirect_url} onFocus={(e) => e.target.select()} />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(created.payment_redirect_url).then(() => setCopied(true))}
              >
                {copied ? t("orderNew.copied") : t("orderNew.copy")}
              </button>
            </div>
          </label>
          <div className="form-actions">
            <Link className="button" href={`/manage/orders/${created.order_number}`}>
              {t("orderNew.viewOrder")}
            </Link>
            <button type="button" onClick={reset}>
              {t("orderNew.another")}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Guide section="orderCreate" />
      <div className="spread">
        <h1>{t("orderNew.title")}</h1>
        <Link className="button" href="/manage/orders">
          {t("nav.orders")}
        </Link>
      </div>
      <Messages errors={errors} />
      <div className="order-layout">
        <div>
          <section className="card">
            <div className="spread card-header">
              <h2 className="card-title">
                <span className="step-number">1</span>
                {t("orderNew.customer")}
              </h2>
              <div className="segmented">
                {(["existing", "new"] as const).map((value) => (
                  <button key={value} type="button" className={mode === value ? "selected" : ""} onClick={() => setMode(value)}>
                    {t(value === "existing" ? "orderNew.existingCustomer" : "orderNew.newCustomer")}
                  </button>
                ))}
              </div>
            </div>
            {mode === "existing" &&
              (customer ? (
                <div className="spread choice selected">
                  <div>
                    <strong>{[customer.first_name, customer.last_name].filter(Boolean).join(" ") || t("common.none")}</strong>
                    <div className="muted" dir="ltr">
                      {customer.mobile}
                    </div>
                  </div>
                  <span className="badge">{t(`tier.${customer.customer_tier}`)}</span>
                  <button type="button" className="small" onClick={() => selectCustomer(null)}>
                    {t("orderNew.changeCustomer")}
                  </button>
                </div>
              ) : (
                <SearchSelect<AdminUser>
                  search={searchOrderCustomers}
                  optionKey={(user) => user.id}
                  placeholder={t("orderNew.searchCustomer")}
                  onSelect={selectCustomer}
                  renderOption={(user) => (
                    <div className="option-main">
                      <span>
                        {[user.first_name, user.last_name].filter(Boolean).join(" ") || t("common.none")}{" "}
                        <span className="muted" dir="ltr">
                          {user.mobile}
                        </span>
                      </span>
                      <span className="badge">{t(`tier.${user.customer_tier}`)}</span>
                    </div>
                  )}
                />
              ))}
            {mode === "new" && (
              <div className="form-grid">
                <label>
                  {t("field.mobile")} *
                  <input
                    dir="ltr"
                    placeholder="09xxxxxxxxx"
                    value={newCustomer.mobile}
                    onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })}
                  />
                </label>
                <label>
                  {t("field.first_name")}
                  <input value={newCustomer.first_name} onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })} />
                </label>
                <label>
                  {t("field.last_name")}
                  <input value={newCustomer.last_name} onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })} />
                </label>
                <label>
                  {t("field.customer_tier")}
                  <select
                    value={newCustomer.customer_tier}
                    onChange={(e) => setNewCustomer({ ...newCustomer, customer_tier: e.target.value as CustomerTier })}
                  >
                    <option value="RETAIL">{t("tier.RETAIL")}</option>
                    <option value="WHOLESALE">{t("tier.WHOLESALE")}</option>
                  </select>
                </label>
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">
              <span className="step-number">2</span>
              {t("orderNew.address")}
            </h2>
            {mode === "existing" && !customer && <p className="muted">{t("orderNew.selectCustomerFirst")}</p>}
            {mode === "existing" && customer && (
              <div className="choice-list">
                {addresses.map((address) => (
                  <label key={address.id} className={`choice${addressId === address.id ? " selected" : ""}`}>
                    <input type="radio" checked={addressId === address.id} onChange={() => setAddressId(address.id)} />
                    <span>
                      <strong>{address.title}</strong> {address.is_default && <span className="badge">{t("orderNew.default")}</span>}
                      <br />
                      <span className="muted">
                        {address.province_name}، {address.city_name}، {address.address_line}
                        <br />
                        {address.receiver_name} · <span dir="ltr">{address.receiver_mobile}</span>
                      </span>
                    </span>
                  </label>
                ))}
                <label className={`choice${addressId === "new" ? " selected" : ""}`}>
                  <input type="radio" checked={addressId === "new"} onChange={() => setAddressId("new")} />
                  <span>
                    <strong>{t("orderNew.newAddress")}</strong>
                    {addresses.length === 0 && <span className="muted"> — {t("orderNew.noAddresses")}</span>}
                  </span>
                </label>
              </div>
            )}
            {usingNewAddress && (mode === "new" || customer) && (
              <div className="form-grid" style={{ marginTop: 16 }}>
                <label>
                  {t("orderNew.province")} *
                  <select
                    value={newAddress.province || ""}
                    onChange={(e) => setNewAddress({ ...newAddress, province: Number(e.target.value), city: 0 })}
                  >
                    <option value="">—</option>
                    {provinces.map((province) => (
                      <option key={province.id} value={province.id}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("orderNew.city")} *
                  <select
                    value={newAddress.city || ""}
                    disabled={!newAddress.province}
                    onChange={(e) => setNewAddress({ ...newAddress, city: Number(e.target.value) })}
                  >
                    <option value="">—</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>
                {ADDRESS_TEXT_FIELDS.map(([field, label, required]) => (
                  <label key={field}>
                    {t(label)}
                    {required && " *"}
                    <input
                      dir={field === "receiver_mobile" || field === "postal_code" ? "ltr" : undefined}
                      value={newAddress[field] as string}
                      onChange={(e) => setNewAddress({ ...newAddress, [field]: e.target.value })}
                    />
                  </label>
                ))}
                <label style={{ gridColumn: "1 / -1" }}>
                  {t("orderNew.addressLine")} *
                  <textarea rows={2} value={newAddress.address_line} onChange={(e) => setNewAddress({ ...newAddress, address_line: e.target.value })} />
                </label>
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">
              <span className="step-number">3</span>
              {t("orderNew.items")}
            </h2>
            <p className="muted">{t("orderNew.priceTier", { tier: t(`tier.${tier}`) })}</p>
            <SearchSelect<OrderVariantOption>
              search={(query) => searchOrderVariants(query, tier)}
              resetKey={tier}
              optionKey={(option) => option.id}
              disabledKeys={lines.map((line) => line.option.id)}
              placeholder={t("orderNew.searchVariant")}
              onSelect={addLine}
              renderOption={(option) => (
                <div className="option-main">
                  <span>
                    <strong>{option.product_name}</strong> {option.variant_label && <span className="muted">({option.variant_label})</span>}
                    <br />
                    <span className="muted" dir="ltr">
                      {option.sku}
                    </span>
                  </span>
                  <span style={{ textAlign: "end" }}>
                    {formatNumber(option.unit_price)}
                    <br />
                    <span className={Number(option.available_quantity) > 0 ? "muted" : "muted strike"}>
                      {t("orderNew.available", { qty: formatNumber(option.available_quantity), unit: option.unit_name })}
                    </span>
                  </span>
                </div>
              )}
            />
            <div className="table-scroll" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t("orderNew.product")}</th>
                    <th>{t("field.unit_price")}</th>
                    <th>{t("field.quantity")}</th>
                    <th>{t("orderNew.lineTotal")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        {t("orderNew.noItems")}
                      </td>
                    </tr>
                  )}
                  {lines.map(({ option, quantity }) => {
                    const serverErrors = lineErrors[String(option.id)];
                    const overStock = Number(quantity) > Number(option.available_quantity);
                    return (
                      <tr key={option.id} className={serverErrors ? "line-error" : undefined}>
                        <td>
                          <strong>{option.product_name}</strong>
                          {option.variant_label && <div className="muted">{option.variant_label}</div>}
                          <div className="muted" dir="ltr">
                            {option.sku}
                          </div>
                          {serverErrors?.map((message) => (
                            <div key={message} className="danger-text">
                              {message}
                            </div>
                          ))}
                        </td>
                        <td>
                          {option.original_unit_price !== option.unit_price && (
                            <div className="strike">{formatNumber(option.original_unit_price)}</div>
                          )}
                          {formatNumber(option.unit_price)}
                        </td>
                        <td>
                          <input
                            type="number"
                            dir="ltr"
                            style={{ width: 110 }}
                            min={option.min_purchase}
                            max={option.max_purchase}
                            step={option.purchase_step}
                            value={quantity}
                            onChange={(e) => setQuantity(option.id, e.target.value)}
                          />
                          <div className={overStock ? "danger-text" : "muted"}>
                            {t("orderNew.available", { qty: formatNumber(option.available_quantity), unit: option.unit_name })}
                          </div>
                          <div className="muted">
                            {t("orderNew.rangeHint", {
                              min: plainNumber(option.min_purchase),
                              max: plainNumber(option.max_purchase),
                              step: plainNumber(option.purchase_step),
                            })}
                          </div>
                        </td>
                        <td>{formatNumber(Number(option.unit_price) * Number(quantity || 0))}</td>
                        <td>
                          <button type="button" className="danger small" onClick={() => removeLine(option.id)}>
                            {t("common.delete")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2 className="card-title">
              <span className="step-number">4</span>
              {t("orderNew.shippingAndCode")}
            </h2>
            <div className="form-grid">
              <label>
                {t("orderNew.shipping")} *
                <select
                  value={shippingId ?? ""}
                  disabled={!cityId || shippingOptions.length === 0}
                  onChange={(e) => setShippingId(Number(e.target.value))}
                >
                  {!cityId && <option value="">{t("orderNew.selectCityFirst")}</option>}
                  {cityId && shippingOptions.length === 0 && <option value="">{t("orderNew.noShipping")}</option>}
                  {shippingOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} — {formatNumber(option.price)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("orderNew.discountCode")}
                <input dir="ltr" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} />
              </label>
            </div>
          </section>
        </div>

        <aside className="card order-summary">
          <h2 className="card-title">{t("orderNew.summary")}</h2>
          <div className="summary-row">
            <span>{t("orders.subtotal")}</span>
            <span>{formatNumber(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>{t("orders.shipping")}</span>
            <span>{shipping ? formatNumber(shipping.price) : t("common.none")}</span>
          </div>
          <div className="summary-row total">
            <span>{t("orderNew.estimated")}</span>
            <span>{formatNumber(subtotal + Number(shipping?.price ?? 0))}</span>
          </div>
          {discountCode.trim() && <p className="muted">{t("orderNew.discountNote")}</p>}
          <p className="muted">{t("orderNew.reservationNote")}</p>
          <button type="button" className="primary block" disabled={!canSubmit} onClick={submit}>
            {submitting ? t("orderNew.submitting") : t("orderNew.submit")}
          </button>
        </aside>
      </div>
    </>
  );
}
