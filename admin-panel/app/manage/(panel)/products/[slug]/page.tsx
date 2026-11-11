import { notFound } from "next/navigation";

import { ProductEditor } from "@/components/ProductEditor";
import type { Product } from "@/lib/api/types";
import { serverGet } from "@/lib/server/session";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await serverGet<Product>(`products/${encodeURIComponent(slug)}/`);
  if (!product) notFound();
  return <ProductEditor product={product} />;
}
