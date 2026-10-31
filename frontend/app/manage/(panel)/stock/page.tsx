import { StockManager } from "@/components/StockManager";
import { t } from "@/lib/i18n/fa";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  return (
    <>
      <h1>{t("nav.stock")}</h1>
      <StockManager initialSlug={product} />
    </>
  );
}
