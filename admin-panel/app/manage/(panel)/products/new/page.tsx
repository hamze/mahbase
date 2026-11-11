import { ProductForm } from "@/components/ProductForm";
import { t } from "@/lib/i18n/fa";

export default function NewProductPage() {
  return (
    <>
      <h1>{t("product.new")}</h1>
      <ProductForm />
    </>
  );
}
