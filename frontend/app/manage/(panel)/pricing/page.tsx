import { PriceAdjuster } from "@/components/PriceAdjuster";
import { t } from "@/lib/i18n/fa";

export default function PricingPage() {
  return (
    <>
      <h1>{t("nav.pricing")}</h1>
      <PriceAdjuster />
    </>
  );
}
